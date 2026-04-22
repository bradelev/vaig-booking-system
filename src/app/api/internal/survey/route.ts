/**
 * VBS-47 — Post-attention survey cron
 * VBS-48 — Google review trigger based on survey score
 *
 * Runs daily. Finds bookings with status=realized and survey_sent_at IS NULL
 * where scheduled_at is in the past. Sends a WA message asking for a 1-5 rating
 * and sets the bot state to awaiting_survey_response so the bot can capture
 * the reply and trigger a Google review request for high scores.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigValue } from "@/lib/config";
import { logger } from "@/lib/logger";
import { sendTextMessage } from "@/lib/whatsapp/logged";
import { upsertSession } from "@/lib/bot/session";
import { shouldSendMessage } from "@/lib/messaging-toggle";
import { requireCronAuth } from "@/lib/auth/require-cron-auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = requireCronAuth(request);
  if (authError) return authError as NextResponse;

  const client = createAdminClient();

  const now = new Date().toISOString();

  type SurveyBookingRow = {
    id: string;
    scheduled_at: string;
    clients: { phone: string; first_name: string | null } | null;
    services: { name: string } | null;
  };

  const { data: rawSurveyBookings, error } = await client
    .from("bookings")
    .select(
      `id, scheduled_at,
       clients(phone, first_name),
       services(name)`
    )
    .eq("status", "realized")
    .is("survey_sent_at", null)
    .lt("scheduled_at", now);

  if (error) {
    logger.error("Survey cron failed to fetch bookings", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const bookings = (rawSurveyBookings ?? []) as unknown as SurveyBookingRow[];

  const businessName = await getConfigValue("business_name", "VAIG");
  const surveyUrl = await getConfigValue("survey_url", "");
  const templateRaw = await getConfigValue(
    "template_survey",
    "⭐ *¿Cómo fue tu experiencia en {businessName}?*\n\nHola {firstName}! Gracias por tu visita de *{serviceName}*.\n\nNos importa mucho tu opinión. Respondé con un número del *1 al 5*:\n\n1️⃣ Muy mala  2️⃣ Mala  3️⃣ Regular  4️⃣ Buena  5️⃣ Excelente{surveyUrlLine}\n\n¡Muchas gracias! 🙏"
  );

  let sent = 0;
  let failed = 0;

  for (const booking of bookings) {
    const phone = booking.clients?.phone;
    if (!phone) continue;

    const { send, phone: targetPhone } = await shouldSendMessage("messaging_survey", phone);
    if (!send) continue;

    const firstName = booking.clients?.first_name ?? "Cliente";
    const serviceName = booking.services?.name ?? "tu sesión";

    const surveyUrlLine = surveyUrl
      ? `\n\n📝 También podés completar nuestra encuesta:\n${surveyUrl}`
      : "";

    const msg = templateRaw
      .replace(/\{businessName\}/g, businessName)
      .replace(/\{firstName\}/g, firstName)
      .replace(/\{serviceName\}/g, serviceName)
      .replace(/\{surveyUrlLine\}/g, surveyUrlLine)
      // legacy placeholder compatibility
      .replace(/\{surveyUrl\}/g, surveyUrl);

    try {
      await sendTextMessage({ to: targetPhone, body: msg }, "cron_survey");
      await client
        .from("bookings")
        .update({ survey_sent_at: new Date().toISOString() })
        .eq("id", booking.id);

      // Set bot state so the next message from this client is treated as their score
      await upsertSession(targetPhone, "awaiting_survey_response", { pendingBookingId: booking.id });

      sent++;
    } catch (err) {
      logger.error("Survey send failed", { booking_id: booking.id, error: err instanceof Error ? err.message : String(err) });
      failed++;
    }
  }

  logger.info("Survey messages sent", { sent, failed });
  return NextResponse.json({ sent, failed });
}
