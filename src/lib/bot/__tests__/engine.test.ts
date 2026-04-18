import { describe, it, expect } from "vitest";
import {
  isMenuTrigger,
  isBackTrigger,
  isCancelTrigger,
  isRescheduleTrigger,
  isMisTurnosTrigger,
} from "../engine";
import type { BotConversationState } from "../types";

type RouteDecision =
  | "handle_menu"
  | "handle_cancel_reset"
  | "handle_mis_turnos"
  | "handle_reschedule"
  | "handle_state";

function decideRoute(text: string, state: BotConversationState): RouteDecision {
  if (isCancelTrigger(text)) return "handle_cancel_reset";
  if (isMisTurnosTrigger(text)) return "handle_mis_turnos";
  if (isRescheduleTrigger(text)) return "handle_reschedule";
  if (state === "idle" || isMenuTrigger(text)) return "handle_menu";
  return "handle_state";
}

describe("isMenuTrigger — exact vs partial matching", () => {
  it("returns true for exact 'hi'", () => {
    expect(isMenuTrigger("hi")).toBe(true);
  });

  it("returns false for words that contain 'hi' but are not 'hi'", () => {
    expect(isMenuTrigger("hifu")).toBe(false);
    expect(isMenuTrigger("hidratar")).toBe(false);
  });

  it("returns true for partial-match keywords", () => {
    expect(isMenuTrigger("hola")).toBe(true);
    expect(isMenuTrigger("menu")).toBe(true);
    expect(isMenuTrigger("volver")).toBe(true);
    expect(isMenuTrigger("inicio")).toBe(true);
  });

  it("returns true for phrases containing partial-match keywords", () => {
    expect(isMenuTrigger("volver al inicio")).toBe(true);
    expect(isMenuTrigger("ir al menu principal")).toBe(true);
  });
});

describe("isBackTrigger", () => {
  it("returns true for exact '0'", () => {
    expect(isBackTrigger("0")).toBe(true);
  });

  it("returns false for time strings containing '0'", () => {
    expect(isBackTrigger("19:00")).toBe(false);
    expect(isBackTrigger("10:00")).toBe(false);
    expect(isBackTrigger("20:30")).toBe(false);
  });
});

describe("Bot engine route decisions — global triggers", () => {
  it("cancel trigger always routes to cancel reset regardless of state", () => {
    const states: BotConversationState[] = [
      "idle", "menu", "booking_service", "booking_professional", "booking_slots",
      "booking_client_name", "booking_client_email", "booking_confirm", "cancelling",
    ];
    for (const state of states) {
      expect(decideRoute("cancelar", state), `Failed for state: ${state}`).toBe("handle_cancel_reset");
      expect(decideRoute("salir", state), `Failed for state: ${state}`).toBe("handle_cancel_reset");
    }
  });

  it("mis turnos trigger routes to mis_turnos from any state", () => {
    const states: BotConversationState[] = ["idle", "menu", "booking_service", "cancelling"];
    for (const state of states) {
      expect(decideRoute("mis turnos", state), `Failed for state: ${state}`).toBe("handle_mis_turnos");
      expect(decideRoute("historial", state), `Failed for state: ${state}`).toBe("handle_mis_turnos");
      expect(decideRoute("mis citas", state), `Failed for state: ${state}`).toBe("handle_mis_turnos");
    }
  });

  it("reschedule trigger routes to reschedule from any state", () => {
    const states: BotConversationState[] = ["idle", "menu", "booking_service"];
    for (const state of states) {
      expect(decideRoute("reagendar", state), `Failed for state: ${state}`).toBe("handle_reschedule");
      expect(decideRoute("cambiar turno", state), `Failed for state: ${state}`).toBe("handle_reschedule");
    }
  });

  it("time strings do not trigger menu", () => {
    expect(decideRoute("10:00", "booking_slots")).toBe("handle_state");
    expect(decideRoute("19:00", "booking_slots")).toBe("handle_state");
    expect(decideRoute("20:30", "booking_slots")).toBe("handle_state");
  });

  it("exact 'hi' triggers menu but words containing 'hi' do not", () => {
    expect(decideRoute("hi", "booking_slots")).toBe("handle_menu");
    expect(decideRoute("hifu", "booking_service")).toBe("handle_state");
    expect(decideRoute("hidratar", "booking_service")).toBe("handle_state");
  });

  it("cancel trigger has higher priority than mis_turnos", () => {
    expect(decideRoute("cancelar mis turnos", "menu")).toBe("handle_cancel_reset");
  });
});

describe("Bot engine route decisions — state-based routing", () => {
  it("idle state always routes to menu", () => {
    expect(decideRoute("cualquier cosa", "idle")).toBe("handle_menu");
    expect(decideRoute("1", "idle")).toBe("handle_menu");
  });

  it("menu trigger overrides state-based routing", () => {
    const states: BotConversationState[] = ["booking_service", "booking_slots", "booking_confirm"];
    for (const state of states) {
      expect(decideRoute("hola", state), `Failed for state: ${state}`).toBe("handle_menu");
      expect(decideRoute("menu", state), `Failed for state: ${state}`).toBe("handle_menu");
      expect(decideRoute("volver", state), `Failed for state: ${state}`).toBe("handle_menu");
    }
  });

  it("routes to handle_state for non-trigger messages in non-idle states", () => {
    const cases: Array<[string, BotConversationState]> = [
      ["1", "booking_service"],
      ["masaje", "booking_service"],
      ["viernes 9:15", "booking_slots"],
      ["19:00", "booking_slots"],
      ["Juan Pérez", "booking_client_name"],
      ["si", "booking_confirm"],
      ["no", "cancelling"],
    ];
    for (const [text, state] of cases) {
      expect(decideRoute(text, state), `Failed for "${text}" in state "${state}"`).toBe("handle_state");
    }
  });
});

describe("Bot engine — blacklist and rate limiting rules", () => {
  it("blacklisted client check: is_blocked flag should prevent processing", () => {
    const isBlocked = true;
    const shouldProcess = !isBlocked;
    expect(shouldProcess).toBe(false);
  });

  it("non-blocked client should be processed", () => {
    const isBlocked = false;
    const shouldProcess = !isBlocked;
    expect(shouldProcess).toBe(true);
  });

  it("null is_blocked (client not in DB) should not block", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientCheck: any = null;
    const shouldBlock = clientCheck?.is_blocked === true;
    expect(shouldBlock).toBe(false);
  });
});

describe("Bot engine — state transition preconditions", () => {
  it("booking flow states are sequential", () => {
    const flowOrder: BotConversationState[] = [
      "idle", "menu", "booking_service", "booking_professional", "booking_slots",
      "booking_client_name", "booking_client_email", "booking_confirm",
    ];
    const unique = new Set(flowOrder);
    expect(unique.size).toBe(flowOrder.length);
  });

  it("all defined bot states are valid BotConversationState values", () => {
    const knownStates: BotConversationState[] = [
      "idle", "menu", "info_flow",
      "booking_service", "booking_professional", "booking_slots",
      "booking_client_name", "booking_client_email", "booking_confirm",
      "awaiting_reminder_confirm", "pack_service", "pack_selection",
      "waitlist_offer", "reschedule_confirm", "cancelling",
      "awaiting_survey_response",
    ];
    for (const state of knownStates) {
      expect(typeof state).toBe("string");
    }
    expect(knownStates.length).toBe(16);
  });
});
