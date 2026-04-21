/**
 * VBS-45 — 24h reminder cron
 * Runs daily at 12:00 UTC (9am BsAs). Finds confirmed bookings scheduled
 * in the next 0–36h that haven't received a reminder yet, sends a WA
 * message, and records confirmation_sent_at.
 */
import { NextRequest, NextResponse } from "next/server";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigValue } from "@/lib/config";
import { logger } from "@/lib/logger";
import { sendTextMessage } from "@/lib/whatsapp/logged";
import { upsertSession } from "@/lib/bot/session";
import { shouldSendMessage } from "@/lib/messaging-toggle";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createAdminClient();

  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + 36 * 3_600_000).toISOString();

  type ReminderBookingRow = {
    id: string;
    scheduled_at: string;
    clients: { phone: string; first_name: string | null } | null;
    services: { name: string } | null;
  };

  const { data: rawRemBookings, error } = await client
    .from("bookings")
    .select(
      `id, scheduled_at,
       clients(phone, first_name),
       services(name)`
    )
    .eq("status", "confirmed")
    .is("confirmation_sent_at", null)
    .gte("scheduled_at", windowStart)
    .lte("scheduled_at", windowEnd);

  if (error) {
    logger.error("Reminder cron failed to fetch bookings", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const bookings = (rawRemBookings ?? []) as unknown as ReminderBookingRow[];

  const businessName = await getConfigValue("business_name", "VAIG");
  const templateRaw = await getConfigValue(
    "template_reminder",
    "⏰ *Recordatorio de turno — {businessName}*\n\nHola {firstName}! Te recordamos tu turno de *{serviceName}* para mañana:\n📅 {dateLabel}\n\n¿Confirmás tu asistencia? Respondé *confirmo* para confirmarlo o *cancelar* si necesitás cancelarlo. 😊"
  );
  let sent = 0;
  let failed = 0;

  for (const booking of bookings) {
    const phone = booking.clients?.phone;
    if (!phone) continue;

    const { send, phone: targetPhone } = await shouldSendMessage("messaging_reminder", phone);
    if (!send) continue;

    const firstName = booking.clients?.first_name ?? "Cliente";
    const serviceName = booking.services?.name ?? "tu servicio";

    const date = new Date(booking.scheduled_at);
    const dateLabel = date.toLocaleDateString("es-AR", {
      timeZone: LOCAL_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const msg = templateRaw
      .replace(/\{businessName\}/g, businessName)
      .replace(/\{firstName\}/g, firstName)
      .replace(/\{serviceName\}/g, serviceName)
      .replace(/\{dateLabel\}/g, dateLabel);

    try {
      await sendTextMessage({ to: targetPhone, body: msg }, "cron_reminder");
      await client
        .from("bookings")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", booking.id);
      // Set bot session so client reply is handled by handleReminderConfirm
      await upsertSession(targetPhone, "awaiting_reminder_confirm", { pendingBookingId: booking.id });
      sent++;
    } catch (err) {
      logger.error("Client reminder send failed", { booking_id: booking.id, error: err instanceof Error ? err.message : String(err) });
      failed++;
    }
  }

  logger.info("Client reminders sent", { sent, failed });

  // ── Professional reminders ──────────────────────────────────────────────────
  // Send each professional with a phone number a summary of their confirmed
  // bookings in the reminder window.
  let profSent = 0;
  let profFailed = 0;

  type ProfRow = { id: string; name: string; phone: string | null };
  type ProfBookingRow = { scheduled_at: string; clients: { first_name: string } | null; services: { name: string } | null };

  const { data: rawProfessionals } = await client
    .from("professionals")
    .select("id, name, phone")
    .eq("is_active", true)
    .not("phone", "is", null);
  const professionals = (rawProfessionals ?? []) as ProfRow[];

  for (const prof of professionals) {
    if (!prof.phone) continue;

    const { send: sendProf, phone: profTargetPhone } = await shouldSendMessage("messaging_reminder", prof.phone);
    if (!sendProf) continue;

    const { data: rawProfBookings } = await client
      .from("bookings")
      .select(
        `scheduled_at,
         clients(first_name),
         services(name)`
      )
      .eq("professional_id", prof.id)
      .eq("status", "confirmed")
      .gte("scheduled_at", windowStart)
      .lte("scheduled_at", windowEnd)
      .order("scheduled_at", { ascending: true });
    const profBookings = (rawProfBookings ?? []) as unknown as ProfBookingRow[];

    if (profBookings.length === 0) continue;

    const lines = profBookings.map(
      (b) => {
        const time = new Date(b.scheduled_at).toLocaleTimeString("es-AR", {
          timeZone: LOCAL_TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const clientName = b.clients?.first_name ?? "Cliente";
        const serviceName = b.services?.name ?? "Servicio";
        return `• ${time} — ${serviceName} (${clientName})`;
      }
    );

    const profMsg =
      `📋 *Turnos de mañana — ${businessName}*\n\n` +
      `Hola ${prof.name}! Estos son tus turnos confirmados:\n\n` +
      lines.join("\n");

    try {
      await sendTextMessage({ to: profTargetPhone, body: profMsg }, "cron_reminder");
      profSent++;
    } catch (err) {
      logger.error("Professional reminder send failed", { professional: prof.name, error: err instanceof Error ? err.message : String(err) });
      profFailed++;
    }
  }

  logger.info("Professional reminders sent", { sent: profSent, failed: profFailed });
  return NextResponse.json({ sent, failed, profSent, profFailed });
}
