/**
 * VBS-42/43 — Google Calendar hooks for bookings.
 * Uses a shared Service Account calendar (GOOGLE_CALENDAR_ID).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarEvent, deleteCalendarEvent } from "./index";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const TZ = "America/Argentina/Buenos_Aires";

/**
 * Creates a Google Calendar event for a confirmed booking.
 * Saves gcal_event_id back to the booking row.
 * Silently skips if env vars are not configured.
 */
export async function createBookingCalendarEvent(bookingId: string): Promise<void> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_CALENDAR_ID) return;

  const client = createAdminClient() as AnyClient;

  const { data: booking, error } = await client
    .from("bookings")
    .select(
      `id, scheduled_at, gcal_event_id,
       clients(first_name, last_name, phone),
       services(name, duration_minutes),
       professionals(name)`
    )
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    console.error(`[GCal] Failed to fetch booking ${bookingId}:`, error);
    return;
  }

  // Skip if event already created
  if (booking.gcal_event_id) return;

  const clientName =
    [booking.clients?.first_name, booking.clients?.last_name].filter(Boolean).join(" ") || "Cliente";
  const serviceName = booking.services?.name ?? "Servicio";
  const professionalName = booking.professionals?.name ?? null;
  const durationMs = (booking.services?.duration_minutes ?? 60) * 60_000;

  const startDate = new Date(booking.scheduled_at);
  const endDate = new Date(startDate.getTime() + durationMs);

  const description =
    `Teléfono: ${booking.clients?.phone ?? "-"}\n` +
    (professionalName ? `Profesional: ${professionalName}\n` : "") +
    `Servicio: ${serviceName}\n` +
    `Duración: ${booking.services?.duration_minutes ?? 60} min`;

  try {
    const eventId = await createCalendarEvent({
      summary: `VAIG: ${clientName} — ${serviceName}`,
      description,
      startIso: startDate.toISOString(),
      endIso: endDate.toISOString(),
      timeZone: TZ,
    });

    await client.from("bookings").update({ gcal_event_id: eventId }).eq("id", bookingId);
    console.log(`[GCal] Event created for booking ${bookingId}: ${eventId}`);
  } catch (err) {
    console.error(`[GCal] Failed to create event for booking ${bookingId}:`, err);
  }
}

/**
 * Deletes the Google Calendar event associated with a booking.
 * Silently skips if no event was created or env vars not set.
 */
export async function deleteBookingCalendarEvent(bookingId: string): Promise<void> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_CALENDAR_ID) return;

  const client = createAdminClient() as AnyClient;

  const { data: booking, error } = await client
    .from("bookings")
    .select("id, gcal_event_id")
    .eq("id", bookingId)
    .single();

  if (error || !booking?.gcal_event_id) return;

  try {
    await deleteCalendarEvent(booking.gcal_event_id);
    await client.from("bookings").update({ gcal_event_id: null }).eq("id", bookingId);
    console.log(`[GCal] Event deleted for booking ${bookingId}`);
  } catch (err) {
    console.error(`[GCal] Failed to delete event for booking ${bookingId}:`, err);
  }
}
