/**
 * Koobing import engine
 *
 * Imports Koobing appointments as VAIG bookings.
 * - Deduplication via koobing_appointment_id (unique index)
 * - Client find-or-create by phone (primary) or name ilike (fallback)
 * - Professional resolved via static Koobing worker_id → VAIG name map
 * - Service resolved via Koobing service_id → VAIG service match by name similarity
 * - Koobing status 2 → confirmed | status -1 → cancelled
 * - start_time is HHMM integer (1500 = 15:00), date is UTC midnight → combine in ART (UTC-3)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { localInputToISO } from "@/lib/timezone";
import {
  fetchKoobingAppointments,
  fetchKoobingServices,
  type KoobingService,
} from "./client";

export interface ImportResult {
  imported: number;
  skipped: number;
  unmatched_service: number; // appointments where service could not be resolved
  errors: string[];
  created: Array<{ name: string; phone: string; service: string; date: string }>;
}

/** Koobing worker_id → VAIG professional name */
const WORKER_NAME_MAP: Record<number, string> = {
  495: "Cynthia",
  496: "Lucia",
  499: "Stephany",
  500: "Angel",
  501: "Iara Machado",
};

/** Koobing status → VAIG booking status */
function mapStatus(koobStatus: number): string {
  if (koobStatus === -1) return "cancelled";
  if (koobStatus === 2) return "confirmed";
  return "pending";
}

/**
 * Parse HHMM integer + ISO date → scheduled_at ISO string in ART (UTC-3).
 * date field from Koobing is like "2026-01-07T00:00:00.000Z" (UTC midnight = local date)
 */
function buildScheduledAt(dateIso: string, startTime: number): string {
  const dateOnly = dateIso.split("T")[0]; // YYYY-MM-DD
  const hours = Math.floor(startTime / 100);
  const minutes = startTime % 100;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  // Construct as ART local time (UTC-3)
  return localInputToISO(`${dateOnly}T${hh}:${mm}`);
}

/** Normalize phone: strip country code 598 prefix if present, keep digits only */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("598") && digits.length === 11) {
    return digits.slice(3); // e.g. "59894020096" → "94020096"
  }
  return digits;
}

/** Simple name similarity: score based on word overlap */
function nameSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean);
  const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean);
  const intersection = wordsA.filter((w) => wordsB.some((wb) => wb.includes(w) || w.includes(wb)));
  return intersection.length / Math.max(wordsA.length, wordsB.length);
}

/** Find best matching VAIG service_id for a Koobing service name */
function findVaigService(
  koobSvc: KoobingService,
  vaigServices: Array<{ id: string; name: string }>
): string | null {
  const target = koobSvc.name.toLowerCase().trim();

  // Exact match first
  const exact = vaigServices.find((s) => s.name.toLowerCase().trim() === target);
  if (exact) return exact.id;

  // Best similarity match (threshold ≥ 0.5)
  let bestId: string | null = null;
  let bestScore = 0;
  for (const vs of vaigServices) {
    const score = nameSimilarity(koobSvc.name, vs.name);
    if (score > bestScore) {
      bestScore = score;
      bestId = vs.id;
    }
  }
  return bestScore >= 0.5 ? bestId : null;
}

export async function importKoobingAppointments({
  from,
  to,
  dryRun = false,
}: {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  dryRun?: boolean;
}): Promise<ImportResult> {
  // Cast to any: koobing_appointment_id not yet in generated DB types (regenerate after migration)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const result: ImportResult = { imported: 0, skipped: 0, unmatched_service: 0, errors: [], created: [] };

  // Load Koobing data
  const [koobApts, koobServices] = await Promise.all([
    fetchKoobingAppointments(from, to),
    fetchKoobingServices(),
  ]);

  // Load existing koobing_appointment_ids for dedup
  const { data: existing } = await db
    .from("bookings")
    .select("koobing_appointment_id")
    .not("koobing_appointment_id", "is", null);
  const existingIds = new Set<number>(
    (existing ?? []).map((r: { koobing_appointment_id: number }) => r.koobing_appointment_id)
  );

  // Load VAIG professionals
  const { data: professionals } = await db
    .from("professionals")
    .select("id, name")
    .eq("is_active", true);
  const profByName: Record<string, string> = {};
  for (const p of professionals ?? []) {
    profByName[p.name.toLowerCase().trim()] = p.id;
  }

  // Load VAIG services
  const { data: vaigServicesRaw } = await db.from("services").select("id, name").eq("is_active", true);
  const vaigServices: Array<{ id: string; name: string }> = vaigServicesRaw ?? [];

  // Build Koobing service_id → VAIG service_id cache
  const koobSvcToVaig = new Map<number, string | null>();
  for (const ks of koobServices) {
    koobSvcToVaig.set(ks.id, findVaigService(ks, vaigServices));
  }

  for (const apt of koobApts) {
    if (existingIds.has(apt.id)) {
      result.skipped++;
      continue;
    }

    try {
      // Resolve professional
      const workerName = WORKER_NAME_MAP[apt.worker_id];
      const professionalId = workerName ? profByName[workerName.toLowerCase().trim()] : undefined;

      // Resolve service
      const koobSvcObj = koobServices.find((s) => s.id === apt.service_id);
      const serviceId = koobSvcObj ? koobSvcToVaig.get(apt.service_id) : null;
      if (!serviceId) result.unmatched_service++;

      // Build scheduled_at
      const scheduledAt = buildScheduledAt(apt.date, apt.start_time);

      // Find or create client
      let clientId: string | undefined;
      const normalizedPhone = normalizePhone(apt.phone);

      // 1. Try by phone
      if (normalizedPhone.length >= 6) {
        const { data: byPhone } = await db
          .from("clients")
          .select("id")
          .ilike("phone", `%${normalizedPhone}`)
          .limit(1)
          .maybeSingle();
        if (byPhone) clientId = byPhone.id;
      }

      // 2. Fallback: by name (only when last name is known to avoid false positives)
      if (!clientId && apt.name.trim()) {
        const nameParts = apt.name.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || null;
        if (lastName) {
          const { data: byName } = await db
            .from("clients")
            .select("id")
            .ilike("first_name", firstName)
            .ilike("last_name", lastName)
            .limit(1)
            .maybeSingle();
          if (byName) clientId = byName.id;
        }
      }

      // 3. Create client if not found
      if (!clientId && apt.name.trim()) {
        if (!dryRun) {
          const nameParts = apt.name.trim().split(/\s+/);
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(" ") || null;
          const { data: newClient } = await db
            .from("clients")
            .insert({
              first_name: firstName,
              last_name: lastName,
              phone: normalizedPhone || null,
              source: "koobing",
            })
            .select("id")
            .single();
          clientId = newClient?.id;
        }
      }

      if (!clientId && !dryRun) {
        result.errors.push(`apt ${apt.id}: could not find or create client for "${apt.name}"`);
        continue;
      }

      const status = mapStatus(apt.status);
      const notes = `[Koobing] ${koobSvcObj?.name ?? `service_id:${apt.service_id}`}${apt.phone ? ` | tel: ${apt.phone}` : ""}`;

      if (!dryRun) {
        const { error } = await db.from("bookings").insert({
          client_id: clientId,
          service_id: serviceId ?? null,
          professional_id: professionalId ?? null,
          scheduled_at: scheduledAt,
          status,
          notes,
          koobing_appointment_id: apt.id,
          source: "koobing",
        });
        if (error) {
          result.errors.push(`apt ${apt.id}: ${error.message}`);
          continue;
        }
      }

      result.imported++;
      result.created.push({
        name: apt.name,
        phone: apt.phone,
        service: koobSvcObj?.name ?? `id:${apt.service_id}`,
        date: scheduledAt.split("T")[0],
      });
    } catch (err) {
      result.errors.push(`apt ${apt.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
