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

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [k, v]) => msg.replace(new RegExp(`\\{${k}\\}`, "g"), v),
    template
  );
}

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

  const adminTemplate = await getConfigValue(
    "template_admin_new_booking",
    "🔔 *Nueva reserva creada*\n\n👤 Cliente: {clientName} ({clientPhone})\n📋 Servicio: {serviceName}\n💆 Profesional: {professionalName}\n📅 Turno: {dateLabel}\n💰 Seña pendiente: ${depositAmount}\n\n_Reserva ID: {bookingId}_"
  );
  const msg = applyTemplate(adminTemplate, {
    clientName: params.clientName,
    clientPhone: params.clientPhone,
    serviceName: params.serviceName,
    professionalName: params.professionalName ?? "-",
    dateLabel,
    depositAmount: params.depositAmount.toLocaleString("es-AR"),
    bookingId: `${params.bookingId.slice(0, 8)}...`,
  });

  try {
    await sendTextMessage({ to: adminPhone, body: msg });
  } catch (err) {
    console.error("[Notifications] Failed to send new booking notification to admin:", err);
  }
}

export interface PackPurchasedNotificationParams {
  clientPhone: string;
  clientName: string;
  packName: string;
  serviceName: string;
  sessionsTotal: number;
}

export async function notifyClientPackPurchased(
  params: PackPurchasedNotificationParams
): Promise<void> {
  const template = await getConfigValue(
    "template_pack_purchased",
    "🎉 *¡Pack adquirido!*\n\nHola {firstName}! Confirmamos la compra de tu pack:\n\n📦 *{packName}*\n📋 Servicio: {serviceName}\n✅ {sessionsTotal} sesiones disponibles\n\nPodés agendar tus turnos cuando quieras escribiéndonos. ¡Gracias! 😊"
  );
  const msg = applyTemplate(template, {
    firstName: params.clientName,
    packName: params.packName,
    serviceName: params.serviceName,
    sessionsTotal: String(params.sessionsTotal),
  });

  try {
    await sendTextMessage({ to: params.clientPhone, body: msg });
  } catch (err) {
    console.error("[Notifications] Failed to send pack purchased notification:", err);
  }
}

export interface ClientCancellationNotificationParams {
  clientPhone: string;
  clientName: string;
  serviceName: string;
  scheduledAt: string;
  reason: string;
}

const REASON_LABELS: Record<string, string> = {
  client_request: "solicitaste la cancelación",
  professional_unavailable: "la profesional no estará disponible",
  scheduling_conflict: "hubo un conflicto de horario",
  other: "surgió un imprevisto",
};

export async function notifyClientCancellation(
  params: ClientCancellationNotificationParams
): Promise<void> {
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

  const reasonText = REASON_LABELS[params.reason] ?? "surgió un imprevisto";

  const template = await getConfigValue(
    "template_cancel_client",
    "❌ *Reserva cancelada*\n\nHola {firstName}, lamentablemente tu turno fue cancelado porque {reasonText}.\n\n📋 Servicio: {serviceName}\n📅 Turno: {dateLabel}\n\nSi querés, podés volver a reservar escribiéndonos cuando gustes. 😊"
  );
  const msg = applyTemplate(template, {
    firstName: params.clientName,
    reasonText,
    serviceName: params.serviceName,
    dateLabel,
  });

  try {
    await sendTextMessage({ to: params.clientPhone, body: msg });
  } catch (err) {
    console.error("[Notifications] Failed to send cancellation notification to client:", err);
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

  const paymentTemplate = await getConfigValue(
    "template_admin_payment_confirmed",
    "✅ *Seña confirmada*\n\n👤 Cliente: {clientName} ({clientPhone})\n📋 Servicio: {serviceName}\n📅 Turno: {dateLabel}\n💰 Monto: ${amount} ({methodLabel})\n\n_Reserva ID: {bookingId}_"
  );
  const msg = applyTemplate(paymentTemplate, {
    clientName: params.clientName,
    clientPhone: params.clientPhone,
    serviceName: params.serviceName,
    dateLabel,
    amount: params.amount.toLocaleString("es-AR"),
    methodLabel,
    bookingId: `${params.bookingId.slice(0, 8)}...`,
  });

  try {
    await sendTextMessage({ to: adminPhone, body: msg });
  } catch (err) {
    console.error("[Notifications] Failed to send payment confirmation to admin:", err);
  }
}
