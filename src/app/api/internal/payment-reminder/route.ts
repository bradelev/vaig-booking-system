/**
 * VBS-84 — Payment reminder cron
 *
 * Runs once daily at 14:00 UTC (11:00 ART). Finds bookings with status=pending where:
 * - created_at is older than payment_reminder_after_hours (default 12h)
 * - created_at is younger than auto_cancel_hours (default 24h)
 * - payment_reminder_sent_at IS NULL (not yet reminded)
 *
 * Sends a WA reminder with the MP payment link and marks payment_reminder_sent_at.
 * This nudges clients who haven't paid before auto-cancel fires.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigValue } from "@/lib/config";
import { sendTextMessage } from "@/lib/whatsapp";
import { createMPPreference } from "@/lib/payments/mp";
import { shouldSendMessage } from "@/lib/messaging-toggle";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any;

  const autoHours = parseInt(await getConfigValue("auto_cancel_hours", "24"));
  const reminderAfterHours = parseInt(
    await getConfigValue("payment_reminder_after_hours", "12")
  );

  const now = Date.now();
  const cancelCutoff = new Date(now - autoHours * 3600_000).toISOString();
  const reminderCutoff = new Date(now - reminderAfterHours * 3600_000).toISOString();

  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      `id, created_at,
       clients(phone, first_name, email),
       services(name, deposit_amount)`
    )
    .eq("status", "pending")
    .is("payment_reminder_sent_at", null)
    .lt("created_at", reminderCutoff)
    .gt("created_at", cancelCutoff);

  if (error) {
    console.error("[PaymentReminder] Failed to fetch bookings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const businessName = await getConfigValue("business_name", "VAIG");
  const mpEnabled =
    (await getConfigValue("mp_enabled", "false")).toLowerCase() === "true";
  const templateRaw = await getConfigValue(
    "template_payment_reminder",
    "⚠️ *Recordatorio de pago — {businessName}*\n\nHola {firstName}! Tu reserva de *{serviceName}* tiene un pago pendiente.\n\n💳 Completá el pago para confirmar tu turno:{paymentLine}\n\nSi no recibimos el pago, la reserva se cancelará automáticamente.\n\n¿Necesitás ayuda? Escribinos 😊"
  );

  let sent = 0;
  let failed = 0;

  for (const booking of bookings ?? []) {
    const phone = booking.clients?.phone;
    if (!phone) continue;

    const { send, phone: targetPhone } = await shouldSendMessage("messaging_payment_reminder", phone);
    if (!send) continue;

    const firstName = booking.clients?.first_name ?? "Cliente";
    const serviceName = booking.services?.name ?? "tu servicio";
    const depositAmount: number = booking.services?.deposit_amount ?? 0;
    const hoursRemaining = Math.max(
      0,
      Math.round(autoHours - (now - new Date(booking.created_at).getTime()) / 3600_000)
    );

    let paymentLine = "";

    if (mpEnabled && depositAmount > 0) {
      try {
        const expiresAt = new Date(
          new Date(booking.created_at).getTime() + autoHours * 3600_000
        );
        const pref = await createMPPreference({
          bookingId: booking.id,
          serviceTitle: serviceName,
          depositAmount,
          expiresAt,
          payerEmail: booking.clients?.email ?? undefined,
        });
        paymentLine = `\n${pref.initPoint}`;
      } catch (e) {
        console.error(`[PaymentReminder] MP preference error for booking ${booking.id}:`, e);
      }
    }

    const msg = templateRaw
      .replace(/\{firstName\}/g, firstName)
      .replace(/\{serviceName\}/g, serviceName)
      .replace(/\{businessName\}/g, businessName)
      .replace(/\{paymentLink\}/g, paymentLine)
      .replace(/\{paymentLine\}/g, paymentLine)
      .replace(/\{hoursRemaining\}/g, String(hoursRemaining));

    try {
      await sendTextMessage({ to: targetPhone, body: msg });
      await client
        .from("bookings")
        .update({ payment_reminder_sent_at: new Date().toISOString() })
        .eq("id", booking.id);
      sent++;
    } catch (err) {
      console.error(`[PaymentReminder] Failed for booking ${booking.id}:`, err);
      failed++;
    }
  }

  console.log(`[PaymentReminder] Sent: ${sent}, Failed: ${failed}`);
  return NextResponse.json({ sent, failed });
}
