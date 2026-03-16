/**
 * VBS-45 — 24h reminder cron
 * Runs daily at 12:00 UTC (9am BsAs). Finds confirmed bookings scheduled
 * in the next 0–36h that haven't received a reminder yet, sends a WA
 * message, and records confirmation_sent_at.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConfigValue } from "@/lib/config";
import { sendTextMessage } from "@/lib/whatsapp";
import { upsertSession } from "@/lib/bot/session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

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
      await sendTextMessage({ to: phone, body: msg });
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

  console.log(`[Reminder] Sent: ${sent}, Failed: ${failed}`);
  return NextResponse.json({ sent, failed });
}
