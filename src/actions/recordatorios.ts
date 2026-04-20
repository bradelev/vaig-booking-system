"use server";

import { revalidatePath } from "next/cache";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateMessage } from "@/lib/whatsapp/logged";
import { sanitizeTemplateParam } from "@/lib/whatsapp/sanitize";
import { upsertSession } from "@/lib/bot/session";

const DELAY_MS = 100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPreCitaInstructions(category: string | null): string {
  const cat = (category ?? "").toLowerCase();
  if (cat.includes("depilacion") || cat.includes("laser"))
    return "En caso de que su cita sea para depilación, venir rasurado/a del día anterior.";
  if (cat.includes("facial") || cat.includes("cejas") || cat.includes("pestana"))
    return "En caso de que su cita sea limpieza facial, lifting o perfilado de cejas, venir sin maquillaje.";
  return "";
}

export type SendRemindersResult = {
  sent: number;
  failed: number;
  errors: string[];
};

export async function sendReminders(
  bookingIds: string[],
  message: string
): Promise<SendRemindersResult> {
  if (!bookingIds.length || !message.trim()) {
    return { sent: 0, failed: 0, errors: ["Parámetros inválidos"] };
  }

  const contactPhone = process.env.VAIG_CONTACT_PHONE ?? "";
  const address = process.env.VAIG_ADDRESS ?? "";
  const accessInstructions = process.env.VAIG_ACCESS_INSTRUCTIONS ?? "";

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  const { data: bookings, error } = await client
    .from("bookings")
    .select("id, scheduled_at, clients(id, phone, first_name), services(name, category)")
    .in("id", bookingIds)
    .in("status", ["confirmed", "deposit_paid", "pending"])
    .is("confirmation_sent_at", null);

  if (error) {
    return { sent: 0, failed: 0, errors: [`Error al obtener citas: ${error.message}`] };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  type RawBooking = {
    id: string;
    scheduled_at: string;
    clients: { id: string; phone: string; first_name: string } | null;
    services: { name: string; category: string | null } | null;
  };

  for (const booking of (bookings ?? []) as RawBooking[]) {
    const phone = booking.clients?.phone;
    const firstName = booking.clients?.first_name || "cliente";

    if (
      !phone ||
      phone.startsWith("historico_") ||
      phone.startsWith("migrated_nophone_")
    ) {
      failed++;
      errors.push(`Booking ${booking.id}: teléfono no válido`);
      continue;
    }

    const serviceName = booking.services?.name ?? "tu servicio";
    const hora = new Date(booking.scheduled_at).toLocaleTimeString("es-AR", {
      timeZone: LOCAL_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const instrucciones = getPreCitaInstructions(booking.services?.category ?? null);

    const personalizedMessage = sanitizeTemplateParam(
      message
        .replace(/\{hora\}/g, hora)
        .replace(/\{servicio\}/g, serviceName)
        .replace(/\{direccion\}/g, address)
        .replace(/\{acceso\}/g, accessInstructions)
        .replace(/\{instrucciones_precita\}/g, instrucciones)
        .replace(/\{telefono\}/g, contactPhone)
    );

    try {
      await sendTemplateMessage(
        {
          to: phone,
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

      await adminClient
        .from("bookings")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", booking.id);

      await upsertSession(phone, "awaiting_reminder_confirm", {
        pendingBookingId: booking.id,
      });

      sent++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Booking ${booking.id}: ${msg}`);
    }

    await sleep(DELAY_MS);
  }

  revalidatePath("/backoffice/recordatorios");

  return { sent, failed, errors };
}
