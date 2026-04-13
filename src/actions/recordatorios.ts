"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateMessage } from "@/lib/whatsapp/logged";
import { upsertSession } from "@/lib/bot/session";

const DELAY_MS = 100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  const { data: bookings, error } = await client
    .from("bookings")
    .select("id, clients(id, phone, first_name)")
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
    clients: { id: string; phone: string; first_name: string } | null;
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
                { type: "text", text: message },
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
