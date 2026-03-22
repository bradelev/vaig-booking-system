/**
 * Bot engine — routes incoming messages through the state machine.
 * Each handler returns the messages to send back to the user.
 */
import { sendTextMessage, sendInteractiveButtons } from "@/lib/whatsapp";
import { buildKnowledgeBase } from "./knowledge";
import { getSession, upsertSession, clearSession, advanceFunnel } from "./session";
import { getNextAvailableSlots, checkSlotAvailability, getNearbySlots, formatSlotLabel } from "@/lib/scheduler/db";
import { artDateTime, getARTComponents } from "@/lib/timezone";
import { getConfigValue } from "@/lib/config";
import { createMPPreference, createPackMPPreference } from "@/lib/payments/mp";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "./rate-limit";
import { answerWithLLM } from "./llm";
import { notifyAdminNewBooking } from "./notifications";
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

export function isMenuTrigger(text: string): boolean {
  const t = normalize(text);
  const exactMatch = ["0", "hi"].includes(t);
  const partialMatch = ["menu", "inicio", "hola", "volver"].some((kw) => t.includes(kw));
  return exactMatch || partialMatch;
}

export function isCancelTrigger(text: string): boolean {
  const t = normalize(text);
  return ["cancelar", "cancel", "salir"].some((kw) => t.includes(kw));
}

export function isRescheduleTrigger(text: string): boolean {
  const t = normalize(text);
  return (
    t.includes("cambiar turno") ||
    t.includes("reagendar") ||
    t.includes("reprogramar") ||
    t.includes("cambiar cita") ||
    t.includes("cambiar reserva")
  );
}

export function isMisTurnosTrigger(text: string): boolean {
  const t = normalize(text);
  return (
    t.includes("mis turnos") ||
    t.includes("mis citas") ||
    t.includes("mis reservas") ||
    t.includes("ver turno") ||
    t.includes("ver reserva") ||
    t === "historial"
  );
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
  // VBS-75: Blacklist check — silently ignore blocked clients
  const dbCheck = createAdminClient() as AnyClient;
  const { data: clientCheck } = await dbCheck
    .from("clients")
    .select("is_blocked, consent_accepted_at")
    .eq("phone", phone)
    .maybeSingle();
  if (clientCheck?.is_blocked) return;

  // VBS-29: Rate limiting check
  const rateLimit = await checkRateLimit(phone);
  if (!rateLimit.allowed) {
    await reply(
      phone,
      "Has enviado demasiados mensajes en poco tiempo. Por favor esperá unos minutos antes de intentar de nuevo. ⏳"
    );
    return;
  }

  // Always allow cancel/menu override
  if (isCancelTrigger(messageText)) {
    await clearSession(phone);
    await reply(phone, "Operación cancelada. Escribí *hola* para volver al menú. 👋");
    return;
  }

  // VBS-87: RNPD consent gate
  const session = await getSession(phone);
  let state: BotConversationState = session?.state ?? "idle";
  let context: BookingFlowContext = session?.context ?? {};

  // VBS-114: Session timeout — clear stale sessions after configurable inactivity
  if (session && state !== "idle") {
    try {
      const timeoutMinutesStr = await getConfigValue("bot_session_timeout_minutes", "30");
      const timeoutMinutes = parseInt(timeoutMinutesStr, 10) || 30;
      const sessionAge = (Date.now() - session.updatedAt.getTime()) / 1000 / 60;
      if (sessionAge > timeoutMinutes) {
        await clearSession(phone);
        state = "idle";
        context = {};
      }
    } catch {
      // config unavailable — skip timeout check, continue with existing session
    }
  }

  if (clientCheck && !clientCheck.consent_accepted_at) {
    if (state === "awaiting_consent") {
      return handleConsentResponse(phone, messageText);
    }
    return handleConsentRequest(phone);
  }

  // VBS-73: Global trigger for "mis turnos"
  if (isMisTurnosTrigger(messageText)) {
    return handleMisTurnos(phone);
  }

  // VBS-71: Global trigger for reschedule
  if (isRescheduleTrigger(messageText)) {
    return handleRescheduleStart(phone);
  }

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
    case "booking_category":
      return handleCategorySelection(phone, text, context);
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
    case "awaiting_reminder_confirm":
      return handleReminderConfirm(phone, text, context);
    case "pack_service":
      return handlePackServiceSelection(phone, text, context);
    case "pack_selection":
      return handlePackSelection(phone, text, context);
    case "waitlist_offer":
      return handleWaitlistConfirm(phone, text, context);
    case "reschedule_confirm":
      return handleRescheduleConfirm(phone, text, context);
    case "cancelling":
      return handleCancelConfirm(phone, text, context);
    case "awaiting_survey_response":
      return handleSurveyResponse(phone, text, context);
    case "awaiting_consent":
      return handleConsentResponse(phone, text);
    default:
      return handleMenu(phone);
  }
}

// ── RNPD consent handlers (VBS-87) ────────────────────────────────────────────

async function handleConsentRequest(phone: string): Promise<void> {
  await upsertSession(phone, "awaiting_consent", {});
  const businessName = await getConfigValue("business_name", "VAIG");
  const privacyUrl = await getConfigValue("privacy_policy_url", "");
  const privacyLine = privacyUrl ? `\n\n📄 Política de privacidad: ${privacyUrl}` : "";
  await reply(
    phone,
    `Hola! Antes de continuar, *${businessName}* necesita tu consentimiento para el tratamiento de tus datos personales según la Ley 18.331 (RNPD — Uruguay).${privacyLine}\n\nTus datos serán usados únicamente para gestionar tus reservas y comunicaciones con el centro.\n\n¿Aceptás el tratamiento de tus datos? Respondé *acepto* para continuar.`
  );
}

async function handleConsentResponse(phone: string, text: string): Promise<void> {
  const t = normalize(text);
  if (t === "acepto" || t.includes("acepto") || t === "si" || t === "sí" || t === "ok") {
    const db = createAdminClient() as AnyClient;
    await db
      .from("clients")
      .update({ consent_accepted_at: new Date().toISOString() })
      .eq("phone", phone);
    await clearSession(phone);
    await reply(phone, "¡Gracias! Tu consentimiento ha sido registrado. 🙏\n\nEscribí *hola* para continuar.");
  } else {
    await reply(
      phone,
      "Entendemos. Sin tu consentimiento no podemos procesar tus datos ni gestionar reservas.\n\nSi cambiás de opinión, escribinos cuando quieras y te enviamos el formulario nuevamente."
    );
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleMenu(phone: string): Promise<void> {
  await upsertSession(phone, "menu", {});
  void advanceFunnel(phone, "started");
  await replyButtons(
    phone,
    "¡Hola! Soy el asistente de *VAIG*. ¿Qué necesitás?",
    [
      { id: "book", title: "Agendar turno" },
      { id: "pack", title: "Comprar pack" },
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

  if (t === "pack" || t.includes("pack") || t === "3") {
    return startPackFlow(phone);
  }

  if (t === "cancel" || t.includes("cancelar") || t === "4") {
    return handleCancelFlow(phone);
  }

  // Unknown — re-show menu
  await handleMenu(phone);
}

async function handleInfoFlow(phone: string, text: string): Promise<void> {
  const t = normalize(text);
  if (t.includes("agendar") || t.includes("turno") || t === "si" || t === "sí") {
    return startBookingFlow(phone);
  }
  if (isMenuTrigger(text)) {
    return handleMenu(phone);
  }

  // VBS-31: Use LLM to answer free-form questions
  const llmEnabled = process.env.ANTHROPIC_API_KEY;
  if (llmEnabled) {
    try {
      const answer = await answerWithLLM(text);
      await reply(phone, answer + "\n\n_Escribí *agendar* para reservar un turno o *hola* para el menú._");
      return;
    } catch (err) {
      console.error("[Bot] LLM error:", err);
      // Fall through to menu
    }
  }

  await handleMenu(phone);
}

async function startBookingFlow(phone: string): Promise<void> {
  const kb = await buildKnowledgeBase();

  if (kb.services.length === 0) {
    await reply(phone, "Lo sentimos, no tenemos servicios disponibles en este momento. 😔");
    return;
  }

  const categories = [...new Set(kb.services.map((s) => s.category ?? "Otros"))].sort();

  await upsertSession(phone, "booking_category", { _categories: categories });

  let msg = "¿Qué tipo de servicio te interesa?\n\n";
  categories.forEach((cat, i) => {
    msg += `*${i + 1}.* ${cat}\n`;
  });
  msg += "\nRespondé con el número o escribí el nombre.";
  await reply(phone, msg);
}

async function handleCategorySelection(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const kb = await buildKnowledgeBase();
  const categories =
    (context._categories as string[]) ??
    [...new Set(kb.services.map((s) => s.category ?? "Otros"))].sort();

  const t = normalize(text);
  const idx = parseInt(t) - 1;

  let selectedCategory: string | null = null;

  if (!isNaN(idx) && idx >= 0 && idx < categories.length) {
    selectedCategory = categories[idx];
  } else {
    selectedCategory = categories.find((cat) => normalize(cat).includes(t)) ?? null;
  }

  if (!selectedCategory) {
    await reply(phone, "No reconocí esa opción. Respondé con el número de categoría.");
    return;
  }

  const servicesInCategory = kb.services.filter(
    (s) => (s.category ?? "Otros") === selectedCategory
  );

  if (servicesInCategory.length === 0) {
    await reply(phone, "No hay servicios disponibles en esa categoría.");
    return;
  }

  let msg = `*${selectedCategory}*\n\n¿Qué servicio te interesa?\n\n`;
  servicesInCategory.forEach((s, i) => {
    msg += `*${i + 1}.* ${s.name} — $${s.price.toLocaleString("es-AR")} (${s.durationMinutes} min)\n`;
  });
  msg += "\nRespondé con el número.";

  await upsertSession(phone, "booking_service", {
    ...context,
    _selectedCategory: selectedCategory,
    _servicesInCategory: servicesInCategory.map((s) => s.id),
  } as BookingFlowContext);
  await reply(phone, msg);
}

async function handleServiceSelection(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const kb = await buildKnowledgeBase();
  const t = normalize(text);

  // Filter to services in the selected category if set
  const categoryServiceIds = context._servicesInCategory as string[] | undefined;
  const servicePool: ServiceInfo[] = categoryServiceIds
    ? kb.services.filter((s) => categoryServiceIds.includes(s.id))
    : kb.services;

  let service: ServiceInfo | undefined;

  const num = parseInt(t);
  if (!isNaN(num) && num >= 1 && num <= servicePool.length) {
    service = servicePool[num - 1];
  } else {
    service = servicePool.find((s) => normalize(s.name).includes(t));
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
  context: BookingFlowContext & { _slots?: SlotOption[]; _requestedSlot?: string }
): Promise<void> {
  const slots = context._slots ?? [];
  const t = normalize(text);

  // VBS-72: Waitlist offer
  if ((t === "espera" || t.includes("lista de espera") || t.includes("anotarme")) && context._requestedSlot) {
    await upsertSession(phone, "waitlist_offer", {
      ...context,
      _requestedSlot: context._requestedSlot,
    });
    await reply(phone, `¿Querés anotarte en lista de espera para ese horario? Si se libera un lugar te avisamos automáticamente.\n\nRespondé *sí* para confirmar o *hola* para volver al menú.`);
    return;
  }
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

      const { available } = await checkSlotAvailability(
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
        // Get nearby slots (±2h same day, then same hour next 3 days)
        const nearbySlots = await getNearbySlots(
          professionalId,
          parsedDate,
          service.durationMinutes,
          bufferMinutes,
          2,
          5
        );

        const timeLabel = parsedDate.toLocaleTimeString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const dateLabel = formatSlotLabel(parsedDate).split(" a las")[0];

        let msg = `❌ ${dateLabel} a las ${timeLabel} no está disponible.\n\n`;

        if (nearbySlots.length > 0) {
          msg += `Alternativas cercanas:\n`;
          nearbySlots.forEach((alt, i) => {
            msg += `*${i + 1}.* ${alt.label}\n`;
          });
          msg += `\nRespondé con el número o escribí otro horario.`;
          msg += `\nTambién podés escribir *espera* para anotarte en lista de espera.`;
        } else {
          msg += `No encontramos alternativas cercanas. Podés:\n`;
          msg += `• Escribir otro horario\n`;
          msg += `• Escribir *espera* para lista de espera`;
        }

        const contextWithAlts = {
          ...context,
          _slots: nearbySlots,
          _requestedSlot: parsedDate.toISOString(),
        } as BookingFlowContext & { _slots: SlotOption[]; _requestedSlot: string };
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
  const client = createAdminClient() as AnyClient;
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
  void advanceFunnel(phone, "data_completed");
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
  const dbClient = createAdminClient() as AnyClient;

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

  // VBS-67: Detect active pack for this client + service
  let clientPackageId: string | null = null;
  let packInfo: { name: string; sessionsUsed: number; sessionsTotal: number } | null = null;

  if (clientId && context.selectedServiceId) {
    const { data: clientPackages } = await dbClient
      .from("client_packages")
      .select(
        `id, sessions_used, sessions_total, paid_at, expires_at,
         service_packages(id, service_id, name)`
      )
      .eq("client_id", clientId);

    const now = new Date();
    const activePackage = (clientPackages ?? []).find((cp: {
      id: string;
      sessions_used: number;
      sessions_total: number;
      paid_at: string | null;
      expires_at: string | null;
      service_packages: { id: string; service_id: string; name: string } | null;
    }) => {
      const sp = cp.service_packages;
      if (!sp) return false;
      if (sp.service_id !== context.selectedServiceId) return false;
      if (cp.sessions_used >= cp.sessions_total) return false;
      if (!cp.paid_at) return false;
      if (cp.expires_at && new Date(cp.expires_at) < now) return false;
      return true;
    });

    if (activePackage) {
      clientPackageId = activePackage.id as string;
      packInfo = {
        name: activePackage.service_packages!.name,
        sessionsUsed: activePackage.sessions_used as number,
        sessionsTotal: activePackage.sessions_total as number,
      };
    }
  }

  // Create booking
  const { data: booking, error: bookingError } = await dbClient
    .from("bookings")
    .insert({
      client_id: clientId,
      service_id: context.selectedServiceId,
      professional_id: context.selectedProfessionalId ?? null,
      scheduled_at: slot.start,
      status: "pending",
      client_package_id: clientPackageId,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    await reply(phone, "Hubo un error al crear la reserva. Por favor intentá más tarde. 😔");
    return;
  }

  const bookingId = booking.id as string;

  // VBS-50: Notify admin of new booking (fire-and-forget)
  void notifyAdminNewBooking({
    bookingId,
    clientName: `${context.clientFirstName ?? ""} ${context.clientLastName ?? ""}`.trim(),
    clientPhone: phone,
    serviceName: service?.name ?? context.selectedServiceName ?? "Servicio",
    professionalName: context.selectedProfessionalName ?? null,
    scheduledAt: slot.start,
    depositAmount: service?.depositAmount ?? 0,
  });

  // VBS-67: If client has an active pack, skip payment flow
  if (packInfo && clientPackageId) {
    const sessionNumber = packInfo.sessionsUsed + 1;
    let packMsg = `🎉 *¡Reserva creada!*\n\n`;
    packMsg += `📅 ${slot.label}\n`;
    packMsg += `Servicio: ${service?.name ?? context.selectedServiceName}\n\n`;
    packMsg += `📦 Sesión ${sessionNumber} de ${packInfo.sessionsTotal} de tu pack *${packInfo.name}*.\n`;
    packMsg += `No necesitás abonar seña. ✅\n\n`;
    packMsg += `¡Gracias! Escribí *hola* si necesitás algo más. 😊`;

    await upsertSession(phone, "awaiting_payment", { pendingBookingId: bookingId });
    await reply(phone, packMsg);
    return;
  }

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
  const dbClient = createAdminClient() as AnyClient;

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

  const dbClient = createAdminClient() as AnyClient;

  await dbClient
    .from("bookings")
    .update({ status: "cancelled", cancellation_reason: "client_request", cancelled_by: "client" })
    .eq("id", context.pendingBookingId);

  await clearSession(phone);
  await reply(phone, "✅ Tu reserva fue cancelada exitosamente.\nEscribí *hola* si necesitás algo más. 👋");
}

// ── Reschedule flow (VBS-71) ──────────────────────────────────────────────────

async function handleRescheduleStart(phone: string): Promise<void> {
  const dbClient = createAdminClient() as AnyClient;

  const { data: clientData } = await dbClient
    .from("clients")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (!clientData?.id) {
    await reply(phone, "No encontramos un perfil asociado a tu número. Escribí *hola* para el menú. 😊");
    return;
  }

  const now = new Date().toISOString();
  const { data: bookings } = await dbClient
    .from("bookings")
    .select("id, scheduled_at, services(name), service_id, professional_id")
    .eq("client_id", clientData.id)
    .in("status", ["pending", "deposit_paid", "confirmed"])
    .gt("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(3);

  if (!bookings || bookings.length === 0) {
    await reply(phone, "No tenés turnos próximos para reagendar. Escribí *hola* para el menú. 😊");
    return;
  }

  const TZ_OPT: Intl.DateTimeFormatOptions = {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", hour12: false,
  };

  let msg = "🔄 *Reagendar turno*\n\n¿Cuál turno querés cambiar?\n\n";
  bookings.forEach((b: { id: string; scheduled_at: string; services?: { name: string } }, i: number) => {
    const label = new Date(b.scheduled_at).toLocaleDateString("es-AR", TZ_OPT);
    msg += `${i + 1}. ${b.services?.name ?? "Servicio"} — ${label}\n`;
  });
  msg += "\nRespondé con el número del turno.";

  await upsertSession(phone, "reschedule_confirm", { _rescheduleBookings: bookings } as BookingFlowContext & { _rescheduleBookings: typeof bookings });
  await reply(phone, msg);
}

async function handleRescheduleConfirm(
  phone: string,
  text: string,
  context: BookingFlowContext & { _rescheduleBookings?: Array<{ id: string; scheduled_at: string; service_id: string; professional_id?: string | null; services?: { name: string } }>; _rescheduleBookingId?: string }
): Promise<void> {
  const t = normalize(text);

  // Step 1: client picks which booking to reschedule
  if (!context._rescheduleBookingId) {
    const bookings = context._rescheduleBookings ?? [];
    const idx = parseInt(t) - 1;
    const booking = bookings[idx];
    if (!booking) {
      await reply(phone, "No reconocí esa opción. Respondé con el número del turno.");
      return;
    }

    // Load next available slots for this service
    const kb = await buildKnowledgeBase();
    const service = kb.services.find((s) => s.id === booking.service_id);
    if (!service) { await handleMenu(phone); return; }

    const bufferMinutes = parseInt(await getConfigValue("buffer_minutes", "0"));
    const slots = await getNextAvailableSlots(
      booking.professional_id ?? kb.professionals[0]?.id ?? "",
      service.durationMinutes,
      bufferMinutes,
      5
    );

    if (slots.length === 0) {
      await reply(phone, "No hay horarios disponibles en este momento. Intentá más tarde. 😔");
      await clearSession(phone);
      return;
    }

    let msg = `📅 *Nuevos horarios disponibles para ${service.name}:*\n\n`;
    slots.forEach((s, i) => { msg += `${i + 1}. ${s.label}\n`; });
    msg += "\nElegí un número o escribí *hola* para cancelar.";

    await upsertSession(phone, "reschedule_confirm", {
      ...context,
      _rescheduleBookingId: booking.id,
      _slots: slots,
      selectedServiceId: booking.service_id,
      selectedProfessionalId: booking.professional_id ?? null,
    } as BookingFlowContext & { _rescheduleBookings: typeof bookings; _rescheduleBookingId: string; _slots: typeof slots });
    await reply(phone, msg);
    return;
  }

  // Step 2: client picks new slot
  const slots = (context as BookingFlowContext & { _slots?: Array<{ start: string; end: string; label: string }> })._slots ?? [];
  const idx = parseInt(t) - 1;
  const newSlot = slots[idx];
  if (!newSlot) {
    await reply(phone, "No reconocí esa opción. Elegí un número de la lista.");
    return;
  }

  const dbClient = createAdminClient() as AnyClient;

  // Cancel old booking, create new one linked via rescheduled_from
  await dbClient
    .from("bookings")
    .update({ status: "cancelled", cancellation_reason: "client_request", cancelled_by: "client", cancellation_note: "Reagendado por el cliente" })
    .eq("id", context._rescheduleBookingId);

  const { data: oldBooking } = await dbClient
    .from("bookings")
    .select("client_id, service_id, professional_id, client_package_id")
    .eq("id", context._rescheduleBookingId)
    .single();

  if (!oldBooking) {
    await reply(phone, "Ocurrió un error. Por favor intentá nuevamente.");
    await clearSession(phone);
    return;
  }

  const { data: newBooking } = await dbClient
    .from("bookings")
    .insert({
      client_id: oldBooking.client_id,
      service_id: oldBooking.service_id,
      professional_id: oldBooking.professional_id,
      scheduled_at: newSlot.start,
      status: "confirmed",
      client_package_id: oldBooking.client_package_id ?? null,
      rescheduled_from: context._rescheduleBookingId,
    })
    .select("id")
    .single();

  if (!newBooking) {
    await reply(phone, "Ocurrió un error al crear el nuevo turno. Por favor intentá nuevamente.");
    await clearSession(phone);
    return;
  }

  await clearSession(phone);
  await reply(phone,
    `✅ *Turno reagendado correctamente*\n\n📅 ${newSlot.label}\n\n¡Te esperamos! Escribí *hola* si necesitás algo más. 😊`
  );
}

// ── Waitlist flow (VBS-72) ────────────────────────────────────────────────────

async function handleWaitlistConfirm(
  phone: string,
  text: string,
  context: BookingFlowContext & { _requestedSlot?: string }
): Promise<void> {
  const t = normalize(text);

  if (!["si", "sí", "yes", "s"].includes(t)) {
    await clearSession(phone);
    await reply(phone, "Entendido. Escribí *hola* cuando quieras ver otros horarios. 👋");
    return;
  }

  const dbClient = createAdminClient() as AnyClient;

  const { data: clientData } = await dbClient
    .from("clients")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (!clientData?.id || !context.selectedServiceId || !context._requestedSlot) {
    await clearSession(phone);
    await reply(phone, "No pudimos registrarte en la lista de espera. Intentá nuevamente desde el menú.");
    return;
  }

  await dbClient.from("waitlist").insert({
    client_id: clientData.id,
    service_id: context.selectedServiceId,
    professional_id: context.selectedProfessionalId ?? null,
    requested_slot: context._requestedSlot,
  });

  await clearSession(phone);
  await reply(phone, "✅ Quedaste anotado/a en lista de espera. Si se libera ese horario te avisamos automáticamente. 😊\n\nEscribí *hola* si necesitás algo más.");
}

export async function notifyWaitlistForSlot(
  serviceId: string,
  professionalId: string | null,
  slotStart: string
): Promise<void> {
  const dbClient = createAdminClient() as AnyClient;

  const slotDate = new Date(slotStart);
  // Check waitlist for entries within 30 min of this slot
  const slotEnd = new Date(slotDate.getTime() + 30 * 60_000).toISOString();

  const { data: waiting } = await dbClient
    .from("waitlist")
    .select("id, clients(phone, first_name), service_id")
    .eq("service_id", serviceId)
    .is("notified_at", null)
    .gte("requested_slot", slotDate.toISOString())
    .lte("requested_slot", slotEnd)
    .order("created_at", { ascending: true })
    .limit(1);

  if (!waiting || waiting.length === 0) return;

  const entry = waiting[0];
  const phone = entry.clients?.phone;
  if (!phone) return;

  const firstName = entry.clients?.first_name ?? "Cliente";
  const dateLabel = slotDate.toLocaleDateString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const msg =
    `🎉 *¡Se liberó un turno!*\n\n` +
    `Hola ${firstName}! Tenemos una disponibilidad para el horario que pediste:\n\n` +
    `📅 ${dateLabel}\n\n` +
    `Escribí *hola* para agendar antes de que se ocupe. ¡Rápido! ⚡`;

  try {
    const { sendTextMessage: send } = await import("@/lib/whatsapp");
    await send({ to: phone, body: msg });
    await dbClient
      .from("waitlist")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", entry.id);
  } catch (err) {
    console.error("[Waitlist] Failed to notify:", err);
  }
}

// ── Historial del cliente (VBS-73) ────────────────────────────────────────────

async function handleMisTurnos(phone: string): Promise<void> {
  const dbClient = createAdminClient() as AnyClient;

  const { data: clientData } = await dbClient
    .from("clients")
    .select("id, first_name")
    .eq("phone", phone)
    .maybeSingle();

  if (!clientData) {
    await reply(phone, "No encontramos un perfil asociado a tu número. Agendá tu primer turno escribiendo *hola*. 😊");
    return;
  }

  const now = new Date().toISOString();

  // Upcoming confirmed bookings (up to 3)
  const { data: upcoming } = await dbClient
    .from("bookings")
    .select("scheduled_at, status, services(name)")
    .eq("client_id", clientData.id)
    .in("status", ["pending", "deposit_paid", "confirmed"])
    .gt("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(3);

  // Last realized bookings (up to 3)
  const { data: past } = await dbClient
    .from("bookings")
    .select("scheduled_at, services(name)")
    .eq("client_id", clientData.id)
    .eq("status", "realized")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: false })
    .limit(3);

  // Active packs
  const { data: activePacks } = await dbClient
    .from("client_packages")
    .select("sessions_used, sessions_total, service_packages(name)")
    .eq("client_id", clientData.id)
    .not("paid_at", "is", null);

  const TZ_OPT: Intl.DateTimeFormatOptions = {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  let msg = `📋 *Tus turnos, ${clientData.first_name}*\n\n`;

  if ((upcoming ?? []).length > 0) {
    msg += `*Próximos turnos:*\n`;
    for (const b of upcoming!) {
      const dateLabel = new Date(b.scheduled_at).toLocaleDateString("es-AR", TZ_OPT);
      const statusLabel: Record<string, string> = {
        pending: "⏳ pendiente seña",
        deposit_paid: "💰 seña pagada",
        confirmed: "✅ confirmado",
      };
      msg += `• ${b.services?.name ?? "Servicio"} — ${dateLabel} (${statusLabel[b.status] ?? b.status})\n`;
    }
    msg += "\n";
  } else {
    msg += `No tenés turnos próximos.\n\n`;
  }

  if ((past ?? []).length > 0) {
    msg += `*Últimas sesiones:*\n`;
    for (const b of past!) {
      const dateLabel = new Date(b.scheduled_at).toLocaleDateString("es-AR", TZ_OPT);
      msg += `• ${b.services?.name ?? "Servicio"} — ${dateLabel}\n`;
    }
    msg += "\n";
  }

  const validPacks = (activePacks ?? []).filter(
    (cp: { sessions_used: number; sessions_total: number }) => cp.sessions_used < cp.sessions_total
  );
  if (validPacks.length > 0) {
    msg += `*Packs activos:*\n`;
    for (const cp of validPacks) {
      const remaining = cp.sessions_total - cp.sessions_used;
      msg += `• ${cp.service_packages?.name ?? "Pack"} — ${remaining} sesión/es restante/s\n`;
    }
    msg += "\n";
  }

  msg += `Escribí *hola* para volver al menú. 😊`;
  await reply(phone, msg);
}

// ── Pack purchase flow (VBS-69) ───────────────────────────────────────────────

async function startPackFlow(phone: string): Promise<void> {
  const kb = await buildKnowledgeBase();

  if (kb.services.length === 0) {
    await reply(phone, "No hay servicios disponibles actualmente. Escribí *hola* para volver al menú.");
    return;
  }

  await upsertSession(phone, "pack_service", {});

  let msg = "📦 *Comprar pack de sesiones*\n\nElegí el servicio para ver los packs disponibles:\n\n";
  kb.services.forEach((s, i) => {
    msg += `${i + 1}. ${s.name}\n`;
  });
  msg += "\nRespondé con el número o el nombre del servicio.";
  await reply(phone, msg);
}

async function handlePackServiceSelection(
  phone: string,
  text: string,
  _context: BookingFlowContext
): Promise<void> {
  const kb = await buildKnowledgeBase();
  const t = normalize(text);

  const service = kb.services.find((s, i) => String(i + 1) === t || normalize(s.name).includes(t));
  if (!service) {
    await reply(phone, "No reconocí ese servicio. Respondé con el número o nombre de la lista.");
    return;
  }

  const dbClient = createAdminClient() as AnyClient;
  const mpEnabled = (await getConfigValue("mp_enabled", "false")) === "true";

  if (!mpEnabled) {
    await reply(phone, "La compra de packs por este medio no está disponible aún. Contactanos para más información.");
    return;
  }

  // Fetch active packs for this service
  const { data: packs } = await dbClient
    .from("service_packages")
    .select("id, name, session_count, price")
    .eq("service_id", service.id)
    .eq("is_active", true)
    .order("session_count");

  if (!packs || packs.length === 0) {
    await reply(phone, `No hay packs disponibles para *${service.name}* en este momento. Escribí *hola* para volver al menú.`);
    return;
  }

  await upsertSession(phone, "pack_selection", { selectedServiceId: service.id, selectedServiceName: service.name });

  let msg = `📦 *Packs disponibles para ${service.name}:*\n\n`;
  packs.forEach((p: { id: string; name: string; session_count: number; price: number }, i: number) => {
    msg += `${i + 1}. *${p.name}* — ${p.session_count} sesiones — $${Number(p.price).toLocaleString("es-AR")}\n`;
  });
  msg += "\nRespondé con el número del pack que querés comprar o *hola* para cancelar.";
  await reply(phone, msg);
}

async function handlePackSelection(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const dbClient = createAdminClient() as AnyClient;

  const { data: packs } = await dbClient
    .from("service_packages")
    .select("id, name, session_count, price")
    .eq("service_id", context.selectedServiceId)
    .eq("is_active", true)
    .order("session_count");

  if (!packs || packs.length === 0) {
    await reply(phone, "No hay packs disponibles. Escribí *hola* para volver al menú.");
    return;
  }

  const t = normalize(text);
  const idx = parseInt(t) - 1;
  const pack = packs[idx] ?? packs.find((p: { name: string }) => normalize(p.name).includes(t));

  if (!pack) {
    await reply(phone, "No reconocí esa opción. Respondé con el número del pack.");
    return;
  }

  // Resolve or create client
  let clientId: string | null = null;
  const { data: clientData } = await dbClient
    .from("clients")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  clientId = clientData?.id ?? null;

  if (!clientId) {
    await reply(phone, "No encontramos tu perfil de cliente. Agendá una cita primero para registrarte. Escribí *hola* para el menú.");
    return;
  }

  // Create unpaid client_package record
  const { data: cp, error: cpError } = await dbClient
    .from("client_packages")
    .insert({
      client_id: clientId,
      package_id: pack.id,
      sessions_total: pack.session_count,
      sessions_used: 0,
    })
    .select("id")
    .single();

  if (cpError || !cp) {
    console.error("[Bot] Failed to create client_package:", cpError);
    await reply(phone, "Hubo un error al procesar tu solicitud. Por favor intentá más tarde.");
    return;
  }

  try {
    const pref = await createPackMPPreference({
      clientPackageId: cp.id as string,
      packName: pack.name,
      price: Number(pack.price),
      payerEmail: context.clientEmail,
    });

    await clearSession(phone);

    let msg = `🛒 *Confirmá la compra de tu pack*\n\n`;
    msg += `📦 *${pack.name}*\n`;
    msg += `📋 Servicio: ${context.selectedServiceName}\n`;
    msg += `✅ ${pack.session_count} sesiones\n`;
    msg += `💰 Total: $${Number(pack.price).toLocaleString("es-AR")}\n\n`;
    msg += `💳 *Pagar con Mercado Pago:*\n${pref.initPoint}\n\n`;
    msg += `Una vez confirmado el pago, tus sesiones quedarán disponibles automáticamente. 😊`;

    await reply(phone, msg);
  } catch (err) {
    console.error("[Bot] Pack MP preference error:", err);
    // Rollback: delete the unpaid client_package
    await dbClient.from("client_packages").delete().eq("id", cp.id);
    await reply(phone, "Hubo un error al generar el link de pago. Por favor intentá más tarde.");
  }
}

// ── Reminder confirmation handler (VBS-46) ────────────────────────────────────

async function handleReminderConfirm(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const t = normalize(text);

  if (isCancelTrigger(text)) {
    if (context.pendingBookingId) {
      const dbClient = createAdminClient() as AnyClient;
      await dbClient
        .from("bookings")
        .update({ status: "cancelled", cancellation_reason: "client_request", cancelled_by: "client" })
        .eq("id", context.pendingBookingId);
    }
    await clearSession(phone);
    await reply(phone, "✅ Tu reserva fue cancelada.\nEscribí *hola* si necesitás algo más. 👋");
    return;
  }

  if (!["si", "sí", "yes", "s", "confirmar", "confirmo"].includes(t)) {
    await reply(phone, "Por favor respondé *confirmo* para confirmar tu turno o *cancelar* si necesitás cancelarlo.");
    return;
  }

  if (context.pendingBookingId) {
    const dbClient = createAdminClient() as AnyClient;
    await dbClient
      .from("bookings")
      .update({ client_confirmed_at: new Date().toISOString() })
      .eq("id", context.pendingBookingId);
  }

  await clearSession(phone);
  await reply(phone, "✅ ¡Turno confirmado! Te esperamos. 😊");
}

// ── VBS-48: Survey response + Google review trigger ───────────────────────────

async function handleSurveyResponse(
  phone: string,
  text: string,
  context: BookingFlowContext
): Promise<void> {
  const score = parseInt(text.trim(), 10);

  if (isNaN(score) || score < 1 || score > 5) {
    await reply(
      phone,
      "Por favor respondé con un número del *1 al 5* para calificar tu experiencia.\n\n1️⃣ Muy mala  2️⃣ Mala  3️⃣ Regular  4️⃣ Buena  5️⃣ Excelente"
    );
    return;
  }

  const dbClient = createAdminClient() as AnyClient;

  if (context.pendingBookingId) {
    await dbClient
      .from("bookings")
      .update({ survey_response: { score, answered_at: new Date().toISOString() } })
      .eq("id", context.pendingBookingId);
  }

  await clearSession(phone);

  const reviewThresholdStr = await getConfigValue("google_review_score_threshold", "4");
  const reviewThreshold = parseInt(reviewThresholdStr, 10) || 4;

  if (score >= reviewThreshold) {
    const googleReviewUrl = await getConfigValue("google_review_url", "");
    if (googleReviewUrl) {
      const businessName = await getConfigValue("business_name", "VAIG");
      const { data: client } = await dbClient
        .from("clients")
        .select("first_name")
        .eq("phone", phone)
        .maybeSingle();
      const firstName = client?.first_name ?? "Cliente";

      const templateRaw = await getConfigValue(
        "template_google_review",
        "🌟 *¡Gracias por tu calificación, {firstName}!*\n\nNos alegra saber que tuviste una buena experiencia en *{businessName}*.\n\n¿Te gustaría compartirla con otras personas? Tu reseña nos ayuda a crecer 🙏\n\n👉 {googleReviewUrl}"
      );

      const msg = templateRaw
        .replace(/\{firstName\}/g, firstName)
        .replace(/\{businessName\}/g, businessName)
        .replace(/\{googleReviewUrl\}/g, googleReviewUrl);

      await reply(phone, msg);
      console.log(`[Survey] Google review sent to ${phone} (score: ${score})`);
      return;
    }
  }

  await reply(phone, "¡Gracias por tu calificación! Nos ayuda a mejorar. 🙏");
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
  // Use ART day-of-week so "lunes" resolves correctly when server is UTC
  const { dayOfWeek: currentArtDay } = getARTComponents(now);

  // candidate tracks the target date (as a Date object used only for date arithmetic)
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
        let daysAhead = (dayNum - currentArtDay + 7) % 7;
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

  // Build the final Date in ART so hour/minute are interpreted as Argentina time
  return artDateTime(candidate, hour, minute);
}
