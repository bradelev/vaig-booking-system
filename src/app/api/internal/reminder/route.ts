/**
 * VBS-232 — Daily reminder cron
 * Runs daily at 12:00 UTC (= 9:00 AM Montevideo / UYT UTC-3).
 *
 * Sends a WhatsApp template reminder to clients whose booking hasn't been
 * notified yet, following these rules:
 *   - Booking is TODAY (local) and scheduled time >= 09:00 → send today.
 *   - Booking is TOMORROW (local) and scheduled time < 09:00 → send today (advance).
 *
 * Also sends each active professional with a phone number a daily summary
 * of their upcoming bookings. Idempotent via professionals.daily_summary_sent_at.
 */
import { NextRequest, NextResponse } from "next/server";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigValue } from "@/lib/config";
import { logger } from "@/lib/logger";
import { sendTemplateMessage, sendTextMessage } from "@/lib/whatsapp/logged";
import { sanitizeTemplateParam } from "@/lib/whatsapp/sanitize";
import { upsertSession } from "@/lib/bot/session";
import { shouldSendMessage } from "@/lib/messaging-toggle";
import { requireCronAuth } from "@/lib/auth/require-cron-auth";
import { relativeDayLabel } from "@/lib/reminders/relative-label";
import { shouldSendNow } from "@/lib/reminders/should-send-now";

function getPreCitaInstructions(category: string | null): string {
  const cat = (category ?? "").toLowerCase();
  if (cat.includes("depilacion") || cat.includes("laser"))
    return "En caso de que su cita sea para depilación, venir rasurado/a del día anterior.";
  if (cat.includes("facial") || cat.includes("cejas") || cat.includes("pestana"))
    return "En caso de que su cita sea limpieza facial, lifting o perfilado de cejas, venir sin maquillaje.";
  return "";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = requireCronAuth(request);
  if (authError) return authError as NextResponse;

  const db = createAdminClient();
  const now = new Date();

  // Look-ahead covers today + tomorrow to catch same-day and advance (early-service) cases
  const windowEnd = new Date(now.getTime() + 48 * 3_600_000).toISOString();

  type ReminderBookingRow = {
    id: string;
    scheduled_at: string;
    clients: { phone: string; first_name: string | null } | null;
    services: { name: string; category: string | null } | null;
    professionals: { id: string; name: string } | null;
  };

  const { data: rawBookings, error } = await db
    .from("bookings")
    .select(
      `id, scheduled_at,
       clients(phone, first_name),
       services(name, category),
       professionals(id, name)`
    )
    .in("status", ["confirmed", "deposit_paid", "pending"])
    .is("confirmation_sent_at", null)
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", windowEnd);

  if (error) {
    logger.error("Reminder cron: failed to fetch bookings", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bookings = (rawBookings ?? []) as unknown as ReminderBookingRow[];

  const contactPhone = process.env.VAIG_CONTACT_PHONE ?? "";
  const address = process.env.VAIG_ADDRESS ?? "";
  const accessInstructions = process.env.VAIG_ACCESS_INSTRUCTIONS ?? "";
  const businessName = await getConfigValue("business_name", "VAIG");

  let sent = 0;
  let failed = 0;

  // Track which professional IDs have bookings being reminded today (for summary)
  const profIdsWithReminders = new Set<string>();

  for (const booking of bookings) {
    if (!shouldSendNow(booking.scheduled_at, now, LOCAL_TIMEZONE)) continue;

    const phone = booking.clients?.phone;
    if (
      !phone ||
      phone.startsWith("historico_") ||
      phone.startsWith("migrated_nophone_")
    ) {
      continue;
    }

    const { send, phone: targetPhone } = await shouldSendMessage("messaging_reminder", phone);
    if (!send) continue;

    const firstName = booking.clients?.first_name ?? "Cliente";
    const serviceName = booking.services?.name ?? "tu servicio";
    const category = booking.services?.category ?? null;

    const hora = new Date(booking.scheduled_at).toLocaleTimeString("es-AR", {
      timeZone: LOCAL_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const { clauseEs } = relativeDayLabel(booking.scheduled_at, LOCAL_TIMEZONE, now);
    // Capitalize first letter of clause: "hoy a las 14:30" → "Hoy a las 14:30"
    const clauseCapitalized = clauseEs.charAt(0).toUpperCase() + clauseEs.slice(1);
    const instrucciones = getPreCitaInstructions(category);

    const messageBody = `Recordatorio de reserva · ${clauseCapitalized} tenés *${serviceName}* · Dirección: ${address} · ${accessInstructions} · ${instrucciones} · Mensaje automático, NO responder a este número · Consultas al ${contactPhone}`;

    // hora is already embedded via clauseEs; the {hora} placeholder is kept for
    // the server action (page) variant — here we inline it directly
    void hora;

    const personalizedMessage = sanitizeTemplateParam(messageBody);

    try {
      await sendTemplateMessage(
        {
          to: targetPhone,
          templateName: "campana_general",
          languageCode: "es_UY",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: firstName },
                { type: "text", text: personalizedMessage },
              ],
            },
          ],
        },
        "admin_reminder"
      );

      await db
        .from("bookings")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", booking.id);

      await upsertSession(targetPhone, "awaiting_reminder_confirm", {
        pendingBookingId: booking.id,
      });

      if (booking.professionals?.id) {
        profIdsWithReminders.add(booking.professionals.id);
      }

      sent++;
    } catch (err) {
      logger.error("Reminder cron: client send failed", {
        booking_id: booking.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  logger.info("Reminder cron: client reminders sent", { sent, failed });

  // ── Professional daily summaries ────────────────────────────────────────────
  let profSent = 0;
  let profFailed = 0;

  if (profIdsWithReminders.size === 0) {
    return NextResponse.json({ sent, failed, profSent, profFailed });
  }

  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: LOCAL_TIMEZONE });

  type ProfRow = {
    id: string;
    name: string;
    phone: string | null;
    daily_summary_sent_at: string | null;
  };

  const { data: rawProfessionals } = await db
    .from("professionals")
    .select("id, name, phone, daily_summary_sent_at")
    .eq("is_active", true)
    .not("phone", "is", null);

  const professionals = (rawProfessionals ?? []) as ProfRow[];

  type ProfBookingRow = {
    scheduled_at: string;
    clients: { first_name: string } | null;
    services: { name: string } | null;
  };

  for (const prof of professionals) {
    if (!prof.phone) continue;
    if (!profIdsWithReminders.has(prof.id)) continue;
    if (prof.daily_summary_sent_at === todayStr) continue;

    const { send: sendProf, phone: profTargetPhone } = await shouldSendMessage("messaging_reminder", prof.phone);
    if (!sendProf) continue;

    const { data: rawProfBookings } = await db
      .from("bookings")
      .select(`scheduled_at, clients(first_name), services(name)`)
      .eq("professional_id", prof.id)
      .in("status", ["confirmed", "deposit_paid", "pending"])
      .gt("scheduled_at", now.toISOString())
      .lte("scheduled_at", windowEnd)
      .order("scheduled_at", { ascending: true });

    const profBookings = (rawProfBookings ?? []) as unknown as ProfBookingRow[];
    if (profBookings.length === 0) continue;

    const lines = profBookings.map((b) => {
      const time = new Date(b.scheduled_at).toLocaleTimeString("es-AR", {
        timeZone: LOCAL_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const clientName = b.clients?.first_name ?? "Cliente";
      const svcName = b.services?.name ?? "Servicio";
      return `• ${time} — ${svcName} (${clientName})`;
    });

    const profMsg =
      `📋 *Turnos próximos — ${businessName}*\n\n` +
      `Hola ${prof.name}! Estos son tus turnos confirmados:\n\n` +
      lines.join("\n");

    try {
      await sendTextMessage({ to: profTargetPhone, body: profMsg }, "cron_reminder");
      await db
        .from("professionals")
        .update({ daily_summary_sent_at: todayStr })
        .eq("id", prof.id);
      profSent++;
    } catch (err) {
      logger.error("Reminder cron: professional summary failed", {
        professional: prof.name,
        error: err instanceof Error ? err.message : String(err),
      });
      profFailed++;
    }
  }

  logger.info("Reminder cron: professional summaries sent", { sent: profSent, failed: profFailed });
  return NextResponse.json({ sent, failed, profSent, profFailed });
}
