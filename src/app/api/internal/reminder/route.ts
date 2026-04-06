/**
 * VBS-45 — 24h reminder cron
 * Runs daily at 12:00 UTC (9am BsAs). Finds confirmed bookings scheduled
 * in the next 0–36h that haven't received a reminder yet, sends a WA
 * message, and records confirmation_sent_at.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigValue } from "@/lib/config";
import { sendTextMessage } from "@/lib/whatsapp";
import { upsertSession } from "@/lib/bot/session";
import { shouldSendMessage } from "@/lib/messaging-toggle";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any;

  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + 36 * 3_600_000).toISOString();

  const { data: bookings, error } = await client
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
    console.error("[Reminder] Failed to fetch bookings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const businessName = await getConfigValue("business_name", "VAIG");
  const templateRaw = await getConfigValue(
    "template_reminder",
    "⏰ *Recordatorio de turno — {businessName}*\n\nHola {firstName}! Te recordamos tu turno de *{serviceName}* para mañana:\n📅 {dateLabel}\n\n¿Confirmás tu asistencia? Respondé *confirmo* para confirmarlo o *cancelar* si necesitás cancelarlo. 😊"
  );
  let sent = 0;
  let failed = 0;

  for (const booking of bookings ?? []) {
    const phone = booking.clients?.phone;
    if (!phone) continue;

    const { send, phone: targetPhone } = await shouldSendMessage("messaging_reminder", phone);
    if (!send) continue;

    const firstName = booking.clients?.first_name ?? "Cliente";
    const serviceName = booking.services?.name ?? "tu servicio";

    const date = new Date(booking.scheduled_at);
    const dateLabel = date.toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
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
      await sendTextMessage({ to: targetPhone, body: msg });
      await client
        .from("bookings")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", booking.id);
      // Set bot session so client reply is handled by handleReminderConfirm
      await upsertSession(phone, "awaiting_reminder_confirm", { pendingBookingId: booking.id });
      sent++;
    } catch (err) {
      console.error(`[Reminder] Failed for booking ${booking.id}:`, err);
      failed++;
    }
  }

  console.log(`[Reminder] Client reminders — Sent: ${sent}, Failed: ${failed}`);

  // ── Professional reminders ──────────────────────────────────────────────────
  // Send each professional with a phone number a summary of their confirmed
  // bookings in the reminder window.
  let profSent = 0;
  let profFailed = 0;

  const { data: professionals } = await client
    .from("professionals")
    .select("id, name, phone")
    .eq("is_active", true)
    .not("phone", "is", null);

  for (const prof of professionals ?? []) {
    if (!prof.phone) continue;

    const { send: sendProf, phone: profTargetPhone } = await shouldSendMessage("messaging_reminder", prof.phone);
    if (!sendProf) continue;

    const { data: profBookings } = await client
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

    if (!profBookings || profBookings.length === 0) continue;

    const lines = profBookings.map(
      (b: { scheduled_at: string; clients: { first_name: string } | null; services: { name: string } | null }) => {
        const time = new Date(b.scheduled_at).toLocaleTimeString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
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
      await sendTextMessage({ to: profTargetPhone, body: profMsg });
      profSent++;
    } catch (err) {
      console.error(`[Reminder] Professional ${prof.name} failed:`, err);
      profFailed++;
    }
  }

  console.log(`[Reminder] Professional reminders — Sent: ${profSent}, Failed: ${profFailed}`);
  return NextResponse.json({ sent, failed, profSent, profFailed });
}
