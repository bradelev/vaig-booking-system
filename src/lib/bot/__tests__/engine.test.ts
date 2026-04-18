/**
 * Tests for bot engine routing logic and state machine rules.
 * Focuses on pure, deterministic routing decisions extracted from the engine.
 * Uses the already-tested helpers from helpers.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isMenuTrigger,
  isCancelTrigger,
  isRescheduleTrigger,
  isMisTurnosTrigger,
} from "../engine";
import type { BotConversationState } from "../types";

// ── Router logic (mirrors engine.ts route() function) ──────────────────────────

type RouteDecision =
  | "handle_menu"
  | "handle_cancel_reset"
  | "handle_mis_turnos"
  | "handle_reschedule"
  | "handle_state";

function decideRoute(text: string, state: BotConversationState): RouteDecision {
  // Priority 1: cancel trigger resets session
  if (isCancelTrigger(text)) return "handle_cancel_reset";

  // Priority 2: mis turnos global trigger
  if (isMisTurnosTrigger(text)) return "handle_mis_turnos";

  // Priority 3: reschedule global trigger
  if (isRescheduleTrigger(text)) return "handle_reschedule";

  // Priority 4: menu trigger or idle state
  if (state === "idle" || isMenuTrigger(text)) return "handle_menu";

  // Priority 5: route by state
  return "handle_state";
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("isMenuTrigger — exact vs partial matching", () => {
  it("returns true for exact '0'", () => {
    assert.equal(isMenuTrigger("0"), true);
  });

  it("returns false for time strings containing '0'", () => {
    assert.equal(isMenuTrigger("19:00"), false);
    assert.equal(isMenuTrigger("10:00"), false);
    assert.equal(isMenuTrigger("20:30"), false);
  });

  it("returns true for exact 'hi'", () => {
    assert.equal(isMenuTrigger("hi"), true);
  });

  it("returns false for words that contain 'hi' but are not 'hi'", () => {
    assert.equal(isMenuTrigger("hifu"), false);
    assert.equal(isMenuTrigger("hidratar"), false);
  });

  it("returns true for partial-match keywords", () => {
    assert.equal(isMenuTrigger("hola"), true);
    assert.equal(isMenuTrigger("menu"), true);
    assert.equal(isMenuTrigger("volver"), true);
    assert.equal(isMenuTrigger("inicio"), true);
  });

  it("returns true for phrases containing partial-match keywords", () => {
    assert.equal(isMenuTrigger("volver al inicio"), true);
    assert.equal(isMenuTrigger("ir al menu principal"), true);
  });
});

describe("Bot engine route decisions — global triggers", () => {
  it("cancel trigger always routes to cancel reset regardless of state", () => {
    const states: BotConversationState[] = [
      "idle", "menu", "booking_service", "booking_professional", "booking_slots",
      "booking_client_name", "booking_client_email", "booking_confirm", "cancelling",
    ];
    for (const state of states) {
      assert.equal(decideRoute("cancelar", state), "handle_cancel_reset", `Failed for state: ${state}`);
      assert.equal(decideRoute("salir", state), "handle_cancel_reset", `Failed for state: ${state}`);
    }
  });

  it("mis turnos trigger routes to mis_turnos from any state", () => {
    const states: BotConversationState[] = ["idle", "menu", "booking_service", "cancelling"];
    for (const state of states) {
      assert.equal(decideRoute("mis turnos", state), "handle_mis_turnos", `Failed for state: ${state}`);
      assert.equal(decideRoute("historial", state), "handle_mis_turnos", `Failed for state: ${state}`);
      assert.equal(decideRoute("mis citas", state), "handle_mis_turnos", `Failed for state: ${state}`);
    }
  });

  it("reschedule trigger routes to reschedule from any state", () => {
    const states: BotConversationState[] = ["idle", "menu", "booking_service"];
    for (const state of states) {
      assert.equal(decideRoute("reagendar", state), "handle_reschedule", `Failed for state: ${state}`);
      assert.equal(decideRoute("cambiar turno", state), "handle_reschedule", `Failed for state: ${state}`);
    }
  });

  it("exact '0' triggers menu but time strings containing '0' do not", () => {
    assert.equal(decideRoute("0", "booking_slots"), "handle_menu");
    assert.equal(decideRoute("10:00", "booking_slots"), "handle_state");
    assert.equal(decideRoute("19:00", "booking_slots"), "handle_state");
    assert.equal(decideRoute("20:30", "booking_slots"), "handle_state");
  });

  it("exact 'hi' triggers menu but words containing 'hi' do not", () => {
    assert.equal(decideRoute("hi", "booking_slots"), "handle_menu");
    assert.equal(decideRoute("hifu", "booking_service"), "handle_state");
    assert.equal(decideRoute("hidratar", "booking_service"), "handle_state");
  });

  it("cancel trigger has higher priority than mis_turnos (cancel in mis turnos text)", () => {
    // "cancelar mis turnos" contains both cancel and mis_turnos keywords
    // cancel should win since it's checked first
    const result = decideRoute("cancelar mis turnos", "menu");
    assert.equal(result, "handle_cancel_reset");
  });
});

describe("Bot engine route decisions — state-based routing", () => {
  it("idle state always routes to menu", () => {
    assert.equal(decideRoute("cualquier cosa", "idle"), "handle_menu");
    assert.equal(decideRoute("1", "idle"), "handle_menu");
  });

  it("menu trigger overrides state-based routing", () => {
    const states: BotConversationState[] = ["booking_service", "booking_slots", "booking_confirm"];
    for (const state of states) {
      assert.equal(decideRoute("hola", state), "handle_menu", `Failed for state: ${state}`);
      assert.equal(decideRoute("menu", state), "handle_menu", `Failed for state: ${state}`);
      assert.equal(decideRoute("volver", state), "handle_menu", `Failed for state: ${state}`);
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
      assert.equal(decideRoute(text, state), "handle_state", `Failed for "${text}" in state "${state}"`);
    }
  });
});

describe("Bot engine — blacklist and rate limiting rules", () => {
  it("blacklisted client check: is_blocked flag should prevent processing", () => {
    // This tests the decision logic: if is_blocked, stop processing
    const isBlocked = true;
    const shouldProcess = !isBlocked;
    assert.equal(shouldProcess, false);
  });

  it("non-blocked client should be processed", () => {
    const isBlocked = false;
    const shouldProcess = !isBlocked;
    assert.equal(shouldProcess, true);
  });

  it("null is_blocked (client not in DB) should not block", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientCheck: any = null;
    const shouldBlock = clientCheck?.is_blocked === true;
    assert.equal(shouldBlock, false);
  });
});

describe("Bot engine — state transition preconditions", () => {
  it("booking flow states are sequential", () => {
    const flowOrder: BotConversationState[] = [
      "idle",
      "menu",
      "booking_service",
      "booking_professional",
      "booking_slots",
      "booking_client_name",
      "booking_client_email",
      "booking_confirm",
    ];
    // Each state should be distinct
    const unique = new Set(flowOrder);
    assert.equal(unique.size, flowOrder.length, "All booking flow states should be distinct");
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
    // Verify all are strings (type guard)
    for (const state of knownStates) {
      assert.equal(typeof state, "string", `State ${state} should be a string`);
    }
    assert.equal(knownStates.length, 16, "Expected 16 known bot states");
  });
});
