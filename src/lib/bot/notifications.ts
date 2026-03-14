/**
 * VBS-50 — Admin notifications via WhatsApp.
 * Sends messages to the admin phone when:
 *   - A new booking is created by a client via the bot
 *   - A payment (seña) is confirmed
 *
 * Admin phone is read from system_config key "admin_phone".
 * If not set, notifications are silently skipped.
 */
import { sendTextMessage } from "@/lib/whatsapp";
import { getConfigValue } from "@/lib/config";

async function getAdminPhone(): Promise<string | null> {
  const phone = await getConfigValue("admin_phone", "");
  return phone.trim() || null;
}

export interface NewBookingNotificationParams {
  bookingId: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  professionalName: string | null;
  scheduledAt: string; // ISO string
  depositAmount: number;
}

export async function notifyAdminNewBooking(params: NewBookingNotificationParams): Promise<void> {
  const adminPhone = await getAdminPhone();
  if (!adminPhone) return;

  const date = new Date(params.scheduledAt);
  const dateLabel = date.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  let msg = `🔔 *Nueva reserva creada*\n\n`;
  msg += `👤 Cliente: ${params.clientName} (${params.clientPhone})\n`;
  msg += `📋 Servicio: ${params.serviceName}\n`;
  if (params.professionalName) {
    msg += `💆 Profesional: ${params.professionalName}\n`;
  }
  msg += `📅 Turno: ${dateLabel}\n`;
  msg += `💰 Seña pendiente: $${params.depositAmount.toLocaleString("es-AR")}\n`;
  msg += `\n_Reserva ID: ${params.bookingId.slice(0, 8)}..._`;

  try {
    await sendTextMessage({ to: adminPhone, body: msg });
  } catch (err) {
    console.error("[Notifications] Failed to send new booking notification to admin:", err);
  }
}

export interface PaymentConfirmedNotificationParams {
  bookingId: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  scheduledAt: string;
  amount: number;
  method: "mercadopago" | "manual" | string;
}

export async function notifyAdminPaymentConfirmed(
  params: PaymentConfirmedNotificationParams
): Promise<void> {
  const adminPhone = await getAdminPhone();
  if (!adminPhone) return;

  const date = new Date(params.scheduledAt);
  const dateLabel = date.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const methodLabel = params.method === "mercadopago" ? "Mercado Pago" : "Transferencia manual";

  let msg = `✅ *Seña confirmada*\n\n`;
  msg += `👤 Cliente: ${params.clientName} (${params.clientPhone})\n`;
  msg += `📋 Servicio: ${params.serviceName}\n`;
  msg += `📅 Turno: ${dateLabel}\n`;
  msg += `💰 Monto: $${params.amount.toLocaleString("es-AR")} (${methodLabel})\n`;
  msg += `\n_Reserva ID: ${params.bookingId.slice(0, 8)}..._`;

  try {
    await sendTextMessage({ to: adminPhone, body: msg });
  } catch (err) {
    console.error("[Notifications] Failed to send payment confirmation to admin:", err);
  }
}
