/**
 * VBS-47 — Post-attention survey cron
 * Runs daily. Finds bookings with status=realized and survey_sent_at IS NULL
 * where scheduled_at is in the past. Sends a WA survey message and
 * records survey_sent_at.
 *
 * Survey link is read from system_config key "survey_url".
 * If not configured, the message is sent without a link.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigValue } from "@/lib/config";
import { sendTextMessage } from "@/lib/whatsapp";

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
    "⭐ *¿Cómo fue tu experiencia en {businessName}?*\n\nHola {firstName}! Gracias por tu visita de *{serviceName}*.\n\nNos importa mucho tu opinión. ¿Podés contarnos cómo estuvo tu experiencia?\n\n📝 Completá esta breve encuesta:\n{surveyUrl}\n\n¡Muchas gracias! 🙏"
  );
  let sent = 0;
  let failed = 0;

  for (const booking of bookings ?? []) {
    const phone = booking.clients?.phone;
    if (!phone) continue;

    const firstName = booking.clients?.first_name ?? "Cliente";
    const serviceName = booking.services?.name ?? "tu sesión";

    let msg = templateRaw
      .replace(/\{businessName\}/g, businessName)
      .replace(/\{firstName\}/g, firstName)
      .replace(/\{serviceName\}/g, serviceName)
      .replace(/\{surveyUrl\}/g, surveyUrl);

    // If no survey URL configured, remove the survey link line
    if (!surveyUrl) {
      msg = msg.replace(/\n?📝 Completá esta breve encuesta:\n\n?/g, "").replace(/\n{3,}/g, "\n\n");
    }

    try {
      await sendTextMessage({ to: phone, body: msg });
      await client
        .from("bookings")
        .update({ survey_sent_at: new Date().toISOString() })
        .eq("id", booking.id);
      sent++;
    } catch (err) {
      console.error(`[Survey] Failed for booking ${booking.id}:`, err);
      failed++;
    }
  }

  console.log(`[Survey] Sent: ${sent}, Failed: ${failed}`);
  return NextResponse.json({ sent, failed });
}
