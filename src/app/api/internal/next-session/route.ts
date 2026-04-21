/**
 * VBS-49 — Next session suggestion cron
 * Runs weekly. For each client, finds their most recent realized booking.
 * If the suggested next date (last booking + interval) is within the next
 * 7 days and there are no future bookings for that service, sends a WA
 * suggestion message.
 *
 * Interval is read from system_config key "next_session_interval_days"
 * (default: 30). A per-service override can be set with key
 * "next_session_interval_days_{service_id}".
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigValue, getConfig } from "@/lib/config";
import { logger } from "@/lib/logger";
import { sendTextMessage } from "@/lib/whatsapp/logged";
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
  const windowEnd = new Date(now.getTime() + 7 * 86_400_000); // 7 days ahead

  // Load all realized bookings (latest per client+service)
  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      `id, scheduled_at, service_id,
       clients(id, phone, first_name),
       services(id, name)`
    )
    .eq("status", "realized")
    .order("scheduled_at", { ascending: false });

  if (error) {
    logger.error("Next-session cron failed to fetch bookings", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const businessName = await getConfigValue("business_name", "VAIG");
  const defaultInterval = parseInt(await getConfigValue("next_session_interval_days", "30"));
  const allConfig = await getConfig();

  // Deduplicate: keep latest realized booking per client+service
  const seen = new Set<string>();
  const candidates: typeof bookings = [];
  for (const b of bookings ?? []) {
    const key = `${b.clients?.id}:${b.service_id}`;
    if (!seen.has(key) && b.clients?.phone) {
      seen.add(key);
      candidates.push(b);
    }
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const booking of candidates) {
    const phone = booking.clients.phone;
    const clientId = booking.clients.id;
    const serviceId = booking.service_id;

    // Per-service interval override
    const intervalDays = parseInt(
      allConfig[`next_session_interval_days_${serviceId}`] ?? String(defaultInterval)
    );

    const lastDate = new Date(booking.scheduled_at);
    const suggestedDate = new Date(lastDate.getTime() + intervalDays * 86_400_000);

    // Only suggest if the window falls in the next 7 days
    if (suggestedDate > windowEnd || suggestedDate < now) {
      skipped++;
      continue;
    }

    // Skip if client already has a future booking for this service
    const { data: futureBookings } = await client
      .from("bookings")
      .select("id")
      .eq("client_id", clientId)
      .eq("service_id", serviceId)
      .in("status", ["pending", "deposit_paid", "confirmed"])
      .gt("scheduled_at", now.toISOString())
      .limit(1);

    if ((futureBookings ?? []).length > 0) {
      skipped++;
      continue;
    }

    const firstName = booking.clients.first_name ?? "Cliente";
    const serviceName = booking.services?.name ?? "tu servicio";
    const dateLabel = suggestedDate.toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const templateRaw = await getConfigValue(
      "template_next_session",
      "💆 *¿Ya es hora de tu próxima sesión?*\n\nHola {firstName}! Han pasado aproximadamente {intervalDays} días desde tu última sesión de *{serviceName}*.\n\n📅 Te sugerimos agendarla alrededor del {dateLabel}.\n\nRespondé *hola* para ver los turnos disponibles o ignorá este mensaje si ya tenés uno coordinado. 😊\n\n_{businessName}_"
    );
    const msg = templateRaw
      .replace(/\{firstName\}/g, firstName)
      .replace(/\{serviceName\}/g, serviceName)
      .replace(/\{dateLabel\}/g, dateLabel)
      .replace(/\{intervalDays\}/g, String(intervalDays))
      .replace(/\{businessName\}/g, businessName);

    const { send, phone: targetPhone } = await shouldSendMessage("messaging_next_session", phone);
    if (!send) { skipped++; continue; }

    try {
      await sendTextMessage({ to: targetPhone, body: msg }, "cron_next_session");
      sent++;
    } catch (err) {
      logger.error("Next-session suggestion send failed", { client_id: clientId, error: err instanceof Error ? err.message : String(err) });
      failed++;
    }
  }

  logger.info("Next-session suggestions sent", { sent, skipped, failed });
  return NextResponse.json({ sent, skipped, failed });
}
