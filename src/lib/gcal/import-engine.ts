/**
 * GCal Import Engine
 *
 * Reads events from Google Calendar and creates corresponding bookings in Supabase.
 * Designed to work both as a Next.js server utility and as a standalone CLI script.
 *
 * Usage (standalone):
 *   npx tsx scripts/import-gcal.ts [--dry-run] [--from <ISO>] [--to <ISO>]
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { listCalendarEvents } from "./index";
import { parseEventSummary } from "./event-parser";
import {
  matchServicesToAbbreviations,
} from "./service-abbreviations";
import { GCAL_COLOR_MAP } from "@/components/backoffice/agenda/agenda-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ eventId: string; summary: string; error: string }>;
  unmatched: Array<{ eventId: string; summary: string; abbreviations: string[] }>;
  created: Array<{
    bookingId: string;
    clientName: string;
    serviceName: string;
    eventSummary: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a Supabase admin client using service role credentials from env.
 * Works in both Next.js and Node.js contexts.
 */
function buildSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Splits a full name into first and last name.
 * "Maria" → { first: "Maria", last: "" }
 * "Maria Garcia" → { first: "Maria", last: "Garcia" }
 * "Maria De Los Angeles" → { first: "Maria", last: "De Los Angeles" }
 */
function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export async function importGCalEvents(options: {
  timeMin: string;
  timeMax: string;
  dryRun?: boolean;
}): Promise<ImportResult> {
  const { timeMin, timeMax, dryRun = false } = options;

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    unmatched: [],
    created: [],
  };

  // --- 1. List calendar events ---
  const events = await listCalendarEvents(timeMin, timeMax);

  if (events.length === 0) {
    return result;
  }

  const supabase = buildSupabaseAdmin();

  // --- 2. Load existing gcal_event_ids to avoid duplicates ---
  const { data: existingRows, error: existingErr } = await supabase
    .from("bookings")
    .select("gcal_event_id")
    .not("gcal_event_id", "is", null);

  if (existingErr) {
    throw new Error(`Failed to load existing gcal_event_ids: ${existingErr.message}`);
  }

  const existingIds = new Set(
    (existingRows ?? []).map((r: { gcal_event_id: string }) => r.gcal_event_id),
  );

  // --- 3. Load active services ---
  const { data: services, error: servicesErr } = await supabase
    .from("services")
    .select("id, name")
    .eq("is_active", true);

  if (servicesErr) {
    throw new Error(`Failed to load services: ${servicesErr.message}`);
  }

  const dbServices: Array<{ id: string; name: string }> = services ?? [];

  // --- 4. Load professionals (for colorId → professional_id resolution) ---
  const { data: professionals, error: profsErr } = await supabase
    .from("professionals")
    .select("id, name");

  if (profsErr) {
    throw new Error(`Failed to load professionals: ${profsErr.message}`);
  }

  // Build name → id map for professionals
  const profByName = new Map<string, string>();
  for (const prof of professionals ?? []) {
    profByName.set((prof.name as string).toLowerCase(), prof.id as string);
  }

  // Helper: resolve colorId to professional_id
  function resolveProfessionalId(colorId?: string): string | null {
    if (!colorId) return null;
    const entry = GCAL_COLOR_MAP[colorId];
    if (!entry) return null;
    return profByName.get(entry.name.toLowerCase()) ?? null;
  }

  // --- 5. Process each event ---
  for (const event of events) {
    try {
      // a. Parse summary
      const parsed = parseEventSummary(event.summary);

      // b. Skip system-created events
      if (parsed.isSystemCreated) {
        result.skipped++;
        continue;
      }

      // c. Skip already-imported events
      if (existingIds.has(event.id)) {
        result.skipped++;
        continue;
      }

      // d. Resolve professional
      const professionalId = resolveProfessionalId(event.colorId);

      // e. Match abbreviations to services
      const matches = matchServicesToAbbreviations(parsed.abbreviations, dbServices);
      const matched = matches.filter((m) => m.confidence !== "unmatched");

      // f. If no abbreviations at all or none matched → report as unmatched
      if (parsed.abbreviations.length > 0 && matched.length === 0) {
        result.unmatched.push({
          eventId: event.id,
          summary: event.summary,
          abbreviations: parsed.abbreviations,
        });
        continue;
      }

      // g. Skip events with no client name
      if (!parsed.clientName) {
        result.unmatched.push({
          eventId: event.id,
          summary: event.summary,
          abbreviations: parsed.abbreviations,
        });
        continue;
      }

      // h. Find or create client
      let clientId: string;

      // Search by first_name + last_name (normalized)
      const { first: searchFirst, last: searchLast } = splitName(parsed.clientName);
      const { data: existingClients, error: clientLookupErr } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .ilike("first_name", searchFirst)
        .ilike("last_name", searchLast || "%")
        .limit(5);

      if (clientLookupErr) {
        throw new Error(`Client lookup failed: ${clientLookupErr.message}`);
      }

      if (existingClients && existingClients.length > 0) {
        clientId = existingClients[0].id as string;
      } else {
        // Create new client
        const { first, last } = splitName(parsed.clientName);

        if (!dryRun) {
          const { data: newClient, error: insertClientErr } = await supabase
            .from("clients")
            .insert({
              first_name: first,
              last_name: last,
              phone: "",
              source: "gcal",
            })
            .select("id")
            .single();

          if (insertClientErr || !newClient) {
            throw new Error(
              `Failed to create client "${parsed.clientName}": ${insertClientErr?.message ?? "no data"}`,
            );
          }

          clientId = newClient.id as string;
        } else {
          // dry-run: use placeholder
          clientId = "dry-run-client-id";
        }
      }

      // i. Create booking(s) — one per matched service (or one if no abbreviations)
      const servicesToBook = matched.length > 0 ? matched : [];

      if (servicesToBook.length === 0) {
        // Event has no abbreviations — skip (service_id is NOT NULL)
        result.unmatched.push({
          eventId: event.id,
          summary: event.summary,
          abbreviations: [],
        });
        continue;
      }

      for (const match of servicesToBook) {
        const bookingPayload = {
          client_id: clientId,
          service_id: match.serviceId,
          professional_id: professionalId,
          scheduled_at: event.start,
          status: "deposit_paid",
          gcal_event_id: event.id,
          notes: `Importado de GCal: ${event.summary}`,
        };

        if (!dryRun) {
          const { data: newBooking, error: bookingErr } = await supabase
            .from("bookings")
            .insert(bookingPayload)
            .select("id")
            .single();

          if (bookingErr || !newBooking) {
            throw new Error(
              `Failed to create booking for "${event.summary}": ${bookingErr?.message ?? "no data"}`,
            );
          }

          result.created.push({
            bookingId: newBooking.id as string,
            clientName: parsed.clientName,
            serviceName: match.serviceName,
            eventSummary: event.summary,
          });
        } else {
          result.created.push({
            bookingId: "dry-run",
            clientName: parsed.clientName,
            serviceName: match.serviceName,
            eventSummary: event.summary,
          });
        }

        result.imported++;
      }

      // Mark event as processed so we don't double-import if it matches multiple services
      existingIds.add(event.id);
    } catch (err: unknown) {
      result.errors.push({
        eventId: event.id,
        summary: event.summary,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
