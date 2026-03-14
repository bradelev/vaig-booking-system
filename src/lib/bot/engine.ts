/**
 * Bot engine — routes incoming messages through the state machine.
 * Each handler returns the messages to send back to the user.
 */
import { sendTextMessage, sendInteractiveButtons } from "@/lib/whatsapp";
import { buildKnowledgeBase } from "./knowledge";
import { getSession, upsertSession, clearSession } from "./session";
import { getNextAvailableSlots, checkSlotAvailability } from "@/lib/scheduler/db";
import { getConfigValue } from "@/lib/config";
import { createMPPreference } from "@/lib/payments/mp";
import { createClient } from "@/lib/supabase/server";
import type { BotConversationState, BookingFlowContext, ServiceInfo, SlotOption } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const TZ = "America/Argentina/Buenos_Aires";

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isMenuTrigger(text: string): boolean {
  const t = normalize(text);
  return ["menu", "inicio", "hola", "hi", "0", "volver"].some((kw) => t.includes(kw));
}

function isCancelTrigger(text: string): boolean {
  const t = normalize(text);
  return ["cancelar", "cancel", "salir"].some((kw) => t.includes(kw));
}

async function reply(phone: string, text: string): Promise<void> {
  await sendTextMessage({ to: phone, body: text });
}

async function replyButtons(
  phone: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
): Promise<void> {
  // WhatsApp buttons max 3, titles max 20 chars
  await sendInteractiveButtons({ to: phone, body, buttons });
}

// ── State machine ─────────────────────────────────────────────────────────────

export async function handleIncomingMessage(phone: string, messageText: string): Promise<void> {
  // Always allow cancel/menu override
  if (isCancelTrigger(messageText)) {
    await clearSession(phone);
    await reply(phone, "Operación cancelada. Escribí *hola* para volver al menú. 👋");
    return;
  }

  const session = await getSession(phone);
  const state: BotConversationState = session?.state ?? "idle";
  const context: BookingFlowContext = session?.context ?? {};

  try {
    await route(phone, messageText, state, context);
  } catch (err) {
    console.error("[Bot] Error in state machine:", err);
    await reply(phone, "Ocurrió un error. Por favor intentá nuevamente o escribí *hola* para empezar. 🙏");
  }
}

async function route(
  phone: string,
  text: string,
  state: BotConversationState,
  context: BookingFlowContext
): Promise<void> {
  if (state === "idle" || isMenuTrigger(text)) {
    return handleMenu(phone);
  }

  switch (state) {
    case "menu":
      return handleMenuSelection(phone, text, context);
    case "info_flow":
      return handleInfoFlow(phone, text);
    case "booking_service":
      return handleServiceSelection(phone, text, context);
    case "booking_professional":
      return handleProfessionalSelection(phone, text, context);
    case "booking_slots":
      return handleSlotSelection(phone, text, context);
    case "booking_client_name":
      return handleClientName(phone, text, context);
    case "booking_client_email":
      return handleClientEmail(phone, text, context);
    case "booking_confirm":
      return handleBookingConfirm(phone, text, context);
    case "cancelling":
      return handleCancelConfirm(phone, text, context);
    default:
      return handleMenu(phone);
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleMenu(phone: string): Promise<void> {
  await upsertSession(phone, "menu", {});
  await replyButtons(
    phone,
    "¡Hola! Soy el asistente de *VAIG*. ¿Qué necesitás?",
    [
      { id: "info", title: "Servicios" },
      { id: "book", title: "Agendar turno" },
      { id: "cancel", title: "Cancelar turno" },
    ]
  );
}

async function handleMenuSelection(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const t = normalize(text);

  if (t === "info" || t.includes("servicio") || t.includes("info") || t === "1") {
    await upsertSession(phone, "info_flow", context);
    const kb = await buildKnowledgeBase();
    let msg = "📋 *Nuestros servicios:*\n\n";
    for (const s of kb.services) {
      msg += `*${s.name}*\n`;
      if (s.description) msg += `${s.description}\n`;
      msg += `⏱ ${s.durationMinutes} min — 💰 $${s.price.toLocaleString("es-AR")}\n\n`;
    }
    msg += "¿Querés agendar un turno? Respondé *agendar* o *hola* para el menú.";
    await reply(phone, msg);
    return;
  }

  if (t === "book" || t.includes("agendar") || t.includes("turno") || t === "2") {
    return startBookingFlow(phone);
  }

  if (t === "cancel" || t.includes("cancelar") || t === "3") {
    return handleCancelFlow(phone);
  }

  // Unknown — re-show menu
  await handleMenu(phone);
}

async function handleInfoFlow(phone: string, text: string): Promise<void> {
  const t = normalize(text);
  if (t.includes("agendar") || t.includes("turno") || t.includes("si") || t.includes("sí")) {
    return startBookingFlow(phone);
  }
  // Back to menu
  await handleMenu(phone);
}

async function startBookingFlow(phone: string): Promise<void> {
  const kb = await buildKnowledgeBase();

  if (kb.services.length === 0) {
    await reply(phone, "Lo sentimos, no tenemos servicios disponibles en este momento. 😔");
    return;
  }

  await upsertSession(phone, "booking_service", {});

  let msg = "¿Qué servicio te interesa?\n\n";
  kb.services.forEach((s, i) => {
    msg += `*${i + 1}.* ${s.name} — ${s.durationMinutes} min — $${s.price.toLocaleString("es-AR")}\n`;
  });
  msg += "\nResponde con el número o el nombre del servicio.";
  await reply(phone, msg);
}

async function handleServiceSelection(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const kb = await buildKnowledgeBase();
  const t = normalize(text);

  let service: ServiceInfo | undefined;

  const num = parseInt(t);
  if (!isNaN(num) && num >= 1 && num <= kb.services.length) {
    service = kb.services[num - 1];
  } else {
    service = kb.services.find((s) => normalize(s.name).includes(t));
  }

  if (!service) {
    await reply(phone, "No encontré ese servicio. Por favor respondé con el número de la lista.");
    return;
  }

  const newContext: BookingFlowContext = {
    ...context,
    selectedServiceId: service.id,
    selectedServiceName: service.name,
  };

  // If service has a default professional, offer it or "any"
  if (service.defaultProfessionalId) {
    const prof = kb.professionals.find((p) => p.id === service.defaultProfessionalId);
    if (prof) {
      await upsertSession(phone, "booking_professional", newContext);
      await replyButtons(
        phone,
        `¡Perfecto! *${service.name}* — ${service.durationMinutes} min.\n\n¿Con quién preferís atenderte?`,
        [
          { id: `prof_${prof.id}`, title: prof.name.slice(0, 20) },
          { id: "prof_any", title: "Cualquier disp." },
        ]
      );
      return;
    }
  }

  if (kb.professionals.length === 0) {
    // No professionals — skip to date selection with null professional
    return proceedToSlotSelection({ ...newContext, selectedProfessionalId: null, selectedProfessionalName: "cualquier profesional" }, phone);
  }

  if (kb.professionals.length === 1) {
    const prof = kb.professionals[0];
    return proceedToSlotSelection(
      { ...newContext, selectedProfessionalId: prof.id, selectedProfessionalName: prof.name },
      phone
    );
  }

  // Multiple professionals — show list
  await upsertSession(phone, "booking_professional", newContext);
  let msg = `¡Perfecto! *${service.name}*\n\n¿Con quién querés atenderte?\n\n`;
  kb.professionals.forEach((p, i) => {
    msg += `*${i + 1}.* ${p.name}\n`;
  });
  msg += "\n*0.* Cualquier profesional disponible\n";
  msg += "\nResponde con el número.";
  await reply(phone, msg);
}

async function handleProfessionalSelection(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const kb = await buildKnowledgeBase();
  const t = normalize(text);

  // Handle interactive button reply (id: prof_<uuid> or prof_any)
  if (t.startsWith("prof_any") || t === "0" || t.includes("cualquier")) {
    return proceedToSlotSelection(
      { ...context, selectedProfessionalId: null, selectedProfessionalName: "cualquier profesional" },
      phone
    );
  }

  // Button id format
  const buttonMatch = text.match(/^prof_(.+)$/);
  if (buttonMatch) {
    const profId = buttonMatch[1];
    const prof = kb.professionals.find((p) => p.id === profId);
    if (prof) {
      return proceedToSlotSelection(
        { ...context, selectedProfessionalId: prof.id, selectedProfessionalName: prof.name },
        phone
      );
    }
  }

  const num = parseInt(t);
  if (!isNaN(num) && num >= 1 && num <= kb.professionals.length) {
    const prof = kb.professionals[num - 1];
    return proceedToSlotSelection(
      { ...context, selectedProfessionalId: prof.id, selectedProfessionalName: prof.name },
      phone
    );
  }

  // Name match
  const prof = kb.professionals.find((p) => normalize(p.name).includes(t));
  if (prof) {
    return proceedToSlotSelection(
      { ...context, selectedProfessionalId: prof.id, selectedProfessionalName: prof.name },
      phone
    );
  }

  await reply(phone, "No encontré esa profesional. Por favor respondé con el número de la lista.");
}

async function proceedToSlotSelection(context: BookingFlowContext, phone: string): Promise<void> {
  const kb = await buildKnowledgeBase();
  const service = kb.services.find((s) => s.id === context.selectedServiceId);
  if (!service) {
    await handleMenu(phone);
    return;
  }

  const bufferMinutes = parseInt(await getConfigValue("buffer_minutes", "0"));

  // Use specific professional or first active one for availability check
  let professionalId = context.selectedProfessionalId;
  if (!professionalId) {
    // Find any available professional
    if (kb.professionals.length > 0) {
      professionalId = kb.professionals[0].id;
    } else {
      await reply(phone, "Lo sentimos, no hay profesionales disponibles en este momento.");
      return;
    }
  }

  const slots = await getNextAvailableSlots(professionalId, service.durationMinutes, bufferMinutes, 3);

  if (slots.length === 0) {
    await reply(
      phone,
      "No encontramos turnos disponibles en los próximos 14 días. Por favor contactanos directamente. 🙏"
    );
    await clearSession(phone);
    return;
  }

  const newContext: BookingFlowContext = { ...context };
  await upsertSession(phone, "booking_slots", newContext);

  let msg = `📅 *Turnos disponibles para ${service.name}*\n`;
  if (context.selectedProfessionalName && context.selectedProfessionalName !== "cualquier profesional") {
    msg += `con ${context.selectedProfessionalName}\n`;
  }
  msg += "\n";
  slots.forEach((slot, i) => {
    msg += `*${i + 1}.* ${slot.label}\n`;
  });
  msg += "\nRespondé con el número del turno que preferís, o escribí el día y horario que buscás (ej: *viernes 10:00*).";

  // Store slots in context for later retrieval
  const contextWithSlots = { ...newContext, _slots: slots } as BookingFlowContext & { _slots: SlotOption[] };
  await upsertSession(phone, "booking_slots", contextWithSlots);

  await reply(phone, msg);
}

async function handleSlotSelection(
  phone: string,
  text: string,
  context: BookingFlowContext & { _slots?: SlotOption[] }
): Promise<void> {
  const slots = context._slots ?? [];
  const t = normalize(text);
  let selectedSlot: SlotOption | undefined;

  const num = parseInt(t);
  if (!isNaN(num) && num >= 1 && num <= slots.length) {
    selectedSlot = slots[num - 1];
  }

  if (!selectedSlot) {
    // Try to parse a custom date/time request
    const kb = await buildKnowledgeBase();
    const service = kb.services.find((s) => s.id === context.selectedServiceId);
    if (!service) return handleMenu(phone);

    // Parse something like "viernes 10:00" or "17/03 15:30"
    const parsedDate = parseUserDateTime(text);
    if (parsedDate) {
      const bufferMinutes = parseInt(await getConfigValue("buffer_minutes", "0"));
      let professionalId = context.selectedProfessionalId;
      if (!professionalId && kb.professionals.length > 0) {
        professionalId = kb.professionals[0].id;
      }
      if (!professionalId) {
        await reply(phone, "No hay profesionales disponibles.");
        return;
      }

      const { available, alternatives } = await checkSlotAvailability(
        professionalId,
        parsedDate,
        service.durationMinutes,
        bufferMinutes
      );

      if (available) {
        selectedSlot = {
          start: parsedDate.toISOString(),
          end: new Date(parsedDate.getTime() + service.durationMinutes * 60_000).toISOString(),
          label: formatDateLabel(parsedDate),
        };
      } else {
        let msg = `❌ El horario solicitado no está disponible.\n\nOtras opciones:\n`;
        alternatives.slice(0, 3).forEach((alt, i) => {
          msg += `*${i + 1}.* ${alt.label}\n`;
        });
        const contextWithAlts = { ...context, _slots: alternatives } as BookingFlowContext & { _slots: SlotOption[] };
        await upsertSession(phone, "booking_slots", contextWithAlts);
        await reply(phone, msg);
        return;
      }
    } else {
      await reply(phone, "No entendí el horario. Por favor elegí un número de la lista o escribí el día y hora (ej: *viernes 10:00*).");
      return;
    }
  }

  const newContext: BookingFlowContext = { ...context, selectedSlot };
  delete (newContext as BookingFlowContext & { _slots?: unknown })._slots;

  // Check if client already exists by phone
  const supabase = await createClient();
  const client = supabase as AnyClient;
  const { data: existingClient } = await client
    .from("clients")
    .select("id, first_name, last_name, email")
    .eq("phone", phone)
    .maybeSingle();

  if (existingClient?.id) {
    // Already know the client — go to confirm
    newContext.clientId = existingClient.id;
    newContext.clientFirstName = existingClient.first_name;
    newContext.clientLastName = existingClient.last_name;
    newContext.clientEmail = existingClient.email;
    await upsertSession(phone, "booking_confirm", newContext);
    await showBookingConfirm(phone, newContext);
  } else {
    await upsertSession(phone, "booking_client_name", newContext);
    await reply(phone, "¡Excelente! Para continuar necesito tus datos.\n\n¿Cuál es tu nombre y apellido?");
  }
}

async function handleClientName(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const parts = text.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || "—";

  const newContext = { ...context, clientFirstName: firstName, clientLastName: lastName };
  await upsertSession(phone, "booking_client_email", newContext);
  await reply(phone, "¿Cuál es tu email? (podés escribir *omitir* si no tenés)");
}

async function handleClientEmail(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const t = text.trim();
  let email: string | undefined;

  if (normalize(t) !== "omitir") {
    if (!t.includes("@")) {
      await reply(phone, "El email no parece válido. Intentá de nuevo o escribí *omitir*.");
      return;
    }
    email = t;
  }

  const newContext = { ...context, clientEmail: email };
  await upsertSession(phone, "booking_confirm", newContext);
  await showBookingConfirm(phone, newContext);
}

async function showBookingConfirm(phone: string, context: BookingFlowContext): Promise<void> {
  const slot = context.selectedSlot;
  if (!slot) return handleMenu(phone);

  const slotDate = new Date(slot.start);
  const label = slot.label ?? formatDateLabel(slotDate);

  let msg = `✅ *Resumen de tu reserva:*\n\n`;
  msg += `🔸 Servicio: *${context.selectedServiceName}*\n`;
  if (context.selectedProfessionalName && context.selectedProfessionalName !== "cualquier profesional") {
    msg += `👤 Profesional: ${context.selectedProfessionalName}\n`;
  }
  msg += `📅 Turno: ${label}\n`;
  msg += `👤 Nombre: ${context.clientFirstName} ${context.clientLastName}\n`;
  if (context.clientEmail) msg += `📧 Email: ${context.clientEmail}\n`;
  msg += `\n¿Confirmás la reserva? Respondé *sí* o *no*.`;

  await reply(phone, msg);
}

async function handleBookingConfirm(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const t = normalize(text);

  if (!["si", "sí", "yes", "s", "confirmar", "confirmo"].includes(t)) {
    await clearSession(phone);
    await reply(phone, "Reserva cancelada. Escribí *hola* cuando quieras intentar de nuevo. 👋");
    return;
  }

  // Create or fetch client
  const supabase = await createClient();
  const dbClient = supabase as AnyClient;

  let clientId = context.clientId;
  if (!clientId) {
    const { data: newClient, error } = await dbClient
      .from("clients")
      .insert({
        first_name: context.clientFirstName ?? "—",
        last_name: context.clientLastName ?? "",
        phone,
        email: context.clientEmail ?? null,
        source: "whatsapp",
      })
      .select("id")
      .single();

    if (error || !newClient) {
      await reply(phone, "Hubo un error al registrar tus datos. Por favor intentá más tarde. 😔");
      return;
    }
    clientId = newClient.id as string;
  }

  const slot = context.selectedSlot!;
  const kb = await buildKnowledgeBase();
  const service = kb.services.find((s) => s.id === context.selectedServiceId);

  // Create booking
  const { data: booking, error: bookingError } = await dbClient
    .from("bookings")
    .insert({
      client_id: clientId,
      service_id: context.selectedServiceId,
      professional_id: context.selectedProfessionalId ?? null,
      scheduled_at: slot.start,
      status: "pending",
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    await reply(phone, "Hubo un error al crear la reserva. Por favor intentá más tarde. 😔");
    return;
  }

  const bookingId = booking.id as string;

  // Build payment message
  const autoHours = parseInt(await getConfigValue("auto_cancel_hours", "24"));
  const expiresAt = new Date(Date.now() + autoHours * 3600_000);
  const mpEnabled = (await getConfigValue("mp_enabled", "false")) === "true";
  const cbu = await getConfigValue("cbu", "");
  const alias = await getConfigValue("cbu_alias", "");
  const businessName = await getConfigValue("business_name", "VAIG");

  let paymentMsg = `🎉 *¡Reserva creada!*\n\n`;
  paymentMsg += `📅 ${slot.label}\n`;
  paymentMsg += `Servicio: ${service?.name ?? context.selectedServiceName}\n\n`;
  paymentMsg += `Para confirmar tu turno, abonás la seña de *$${(service?.depositAmount ?? 0).toLocaleString("es-AR")}*.\n\n`;

  if (mpEnabled) {
    try {
      const pref = await createMPPreference({
        bookingId,
        serviceTitle: service?.name ?? context.selectedServiceName ?? "Servicio",
        depositAmount: service?.depositAmount ?? 0,
        expiresAt,
        payerEmail: context.clientEmail,
      });
      paymentMsg += `💳 *Pagar con Mercado Pago:*\n${pref.initPoint}\n\n`;
    } catch (e) {
      console.error("[Bot] MP preference error:", e);
    }
  }

  if (cbu) {
    paymentMsg += `🏦 *Transferencia bancaria:*\nCBU: ${cbu}`;
    if (alias) paymentMsg += `\nAlias: ${alias}`;
    paymentMsg += `\nTitular: ${businessName}\n\n`;
  }

  paymentMsg += `⚠️ Tenés ${autoHours}hs para abonar la seña, de lo contrario la reserva se cancelará automáticamente.\n\n`;
  paymentMsg += `¡Gracias! Escribí *hola* si necesitás algo más. 😊`;

  await upsertSession(phone, "awaiting_payment", { pendingBookingId: bookingId });
  await reply(phone, paymentMsg);
}

// ── Cancel flow ───────────────────────────────────────────────────────────────

async function handleCancelFlow(phone: string): Promise<void> {
  const supabase = await createClient();
  const dbClient = supabase as AnyClient;

  // Find client by phone
  const { data: clientData } = await dbClient
    .from("clients")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (!clientData?.id) {
    await reply(phone, "No encontramos reservas asociadas a este número. 😕\nEscribí *hola* para volver al menú.");
    await clearSession(phone);
    return;
  }

  // Find active bookings
  const { data: bookings } = await dbClient
    .from("bookings")
    .select("id, scheduled_at, status, services(name)")
    .eq("client_id", clientData.id)
    .in("status", ["pending", "deposit_paid", "confirmed"])
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(3);

  if (!bookings || bookings.length === 0) {
    await reply(phone, "No tenés reservas activas para cancelar. 😕\nEscribí *hola* para volver al menú.");
    await clearSession(phone);
    return;
  }

  const booking = bookings[0];
  const serviceName = (booking.services as { name: string } | null)?.name ?? "servicio";
  const dateLabel = formatDateLabel(new Date(booking.scheduled_at as string));

  await upsertSession(phone, "cancelling", { pendingBookingId: booking.id as string });
  await replyButtons(
    phone,
    `Tu reserva de *${serviceName}* el ${dateLabel}.\n\n¿Confirmás la cancelación?`,
    [
      { id: "confirm_cancel", title: "Sí, cancelar" },
      { id: "keep", title: "No, mantener" },
    ]
  );
}

async function handleCancelConfirm(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const t = normalize(text);

  if (!["si", "sí", "yes", "confirm_cancel"].includes(t)) {
    await clearSession(phone);
    await reply(phone, "Tu reserva se mantiene. ¡Hasta pronto! 👋");
    return;
  }

  if (!context.pendingBookingId) {
    await handleCancelFlow(phone);
    return;
  }

  const supabase = await createClient();
  const dbClient = supabase as AnyClient;

  await dbClient
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", context.pendingBookingId);

  await clearSession(phone);
  await reply(phone, "✅ Tu reserva fue cancelada exitosamente.\nEscribí *hola* si necesitás algo más. 👋");
}

// ── Date parsing helpers ──────────────────────────────────────────────────────

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parseUserDateTime(text: string): Date | null {
  // Try to parse patterns like "viernes 10:00", "17/03 15:30", "mañana 10:00"
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;

  const hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);

  const now = new Date();
  const candidate = new Date(now);

  const t = normalize(text);

  if (t.includes("manana") || t.includes("mañana")) {
    candidate.setDate(now.getDate() + 1);
  } else if (t.includes("pasado")) {
    candidate.setDate(now.getDate() + 2);
  } else {
    // Try day name
    const dayMap: Record<string, number> = {
      domingo: 0, lunes: 1, martes: 2, miercoles: 3,
      jueves: 4, viernes: 5, sabado: 6,
    };
    for (const [name, dayNum] of Object.entries(dayMap)) {
      if (t.includes(name)) {
        const currentDay = now.getDay();
        let daysAhead = (dayNum - currentDay + 7) % 7;
        if (daysAhead === 0) daysAhead = 7; // next week same day
        candidate.setDate(now.getDate() + daysAhead);
        break;
      }
    }

    // Try dd/mm pattern
    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
      candidate.setMonth(month, day);
      if (candidate < now) candidate.setFullYear(now.getFullYear() + 1);
    }
  }

  candidate.setHours(hour, minute, 0, 0);
  return candidate;
}
