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
import { sendTextMessage } from "@/lib/whatsapp";
import { upsertSession } from "@/lib/bot/session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any;

  const now = new Date().toISOString();

  const { data: bookings, error } = await client
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
    console.error("[Survey] Failed to fetch bookings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const businessName = await getConfigValue("business_name", "VAIG");
  const surveyUrl = await getConfigValue("survey_url", "");
  const templateRaw = await getConfigValue(
    "template_survey",
    "⭐ *¿Cómo fue tu experiencia en {businessName}?*\n\nHola {firstName}! Gracias por tu visita de *{serviceName}*.\n\nNos importa mucho tu opinión. Respondé con un número del *1 al 5*:\n\n1️⃣ Muy mala  2️⃣ Mala  3️⃣ Regular  4️⃣ Buena  5️⃣ Excelente{surveyUrlLine}\n\n¡Muchas gracias! 🙏"
  );

  let sent = 0;
  let failed = 0;

  for (const booking of bookings ?? []) {
    const phone = booking.clients?.phone;
    if (!phone) continue;

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
      await sendTextMessage({ to: phone, body: msg });
      await client
        .from("bookings")
        .update({ survey_sent_at: new Date().toISOString() })
        .eq("id", booking.id);

      // Set bot state so the next message from this client is treated as their score
      await upsertSession(phone, "awaiting_survey_response", { pendingBookingId: booking.id });

      sent++;
    } catch (err) {
      console.error(`[Survey] Failed for booking ${booking.id}:`, err);
      failed++;
    }
  }

  console.log(`[Survey] Sent: ${sent}, Failed: ${failed}`);
  return NextResponse.json({ sent, failed });
}
