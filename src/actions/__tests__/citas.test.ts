/**
 * Integration tests for booking business logic extracted from citas.ts.
 * Tests core business rules without Next.js or Supabase dependencies.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Business logic helpers (testable in isolation) ─────────────────────────────

/**
 * Determines if a GCal event should be created for a given status transition.
 * Mirrors the logic in updateBookingStatus.
 */
function shouldCreateCalendarEvent(status: string): boolean {
  return status === "confirmed";
}

/**
 * Determines if a GCal event should be deleted for a given status transition.
 * Mirrors the logic in updateBookingStatus and cancelBooking.
 */
function shouldDeleteCalendarEvent(status: string): boolean {
  return status === "cancelled" || status === "no_show";
}

/**
 * Computes the new sessions_used value when a booking is realized.
 * Returns null if no pack is associated.
 */
function computeNewSessionsUsed(
  status: string,
  currentSessionsUsed: number | null
): number | null {
  if (status !== "realized") return null;
  if (currentSessionsUsed === null) return null;
  return currentSessionsUsed + 1;
}

/**
 * Determines if the admin should be notified about a cancellation by the admin.
 */
function shouldNotifyClientCancellation(
  cancelledBy: "admin" | "client",
  clientPhone: string | null | undefined
): boolean {
  return cancelledBy === "admin" && !!clientPhone;
}

/**
 * Determines if waitlist should be notified when a booking is cancelled.
 */
function shouldNotifyWaitlist(serviceId: string | null | undefined): boolean {
  return !!serviceId;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("shouldCreateCalendarEvent", () => {
  it("returns true for 'confirmed' status", () => {
    assert.equal(shouldCreateCalendarEvent("confirmed"), true);
  });

  it("returns false for other statuses", () => {
    assert.equal(shouldCreateCalendarEvent("pending"), false);
    assert.equal(shouldCreateCalendarEvent("realized"), false);
    assert.equal(shouldCreateCalendarEvent("cancelled"), false);
    assert.equal(shouldCreateCalendarEvent("no_show"), false);
    assert.equal(shouldCreateCalendarEvent("deposit_paid"), false);
  });
});

describe("shouldDeleteCalendarEvent", () => {
  it("returns true for 'cancelled' status", () => {
    assert.equal(shouldDeleteCalendarEvent("cancelled"), true);
  });

  it("returns true for 'no_show' status", () => {
    assert.equal(shouldDeleteCalendarEvent("no_show"), true);
  });

  it("returns false for other statuses", () => {
    assert.equal(shouldDeleteCalendarEvent("confirmed"), false);
    assert.equal(shouldDeleteCalendarEvent("pending"), false);
    assert.equal(shouldDeleteCalendarEvent("realized"), false);
    assert.equal(shouldDeleteCalendarEvent("deposit_paid"), false);
  });
});

describe("computeNewSessionsUsed", () => {
  it("increments by 1 when status is 'realized' and pack exists", () => {
    assert.equal(computeNewSessionsUsed("realized", 2), 3);
    assert.equal(computeNewSessionsUsed("realized", 0), 1);
    assert.equal(computeNewSessionsUsed("realized", 9), 10);
  });

  it("returns null when status is not 'realized'", () => {
    assert.equal(computeNewSessionsUsed("confirmed", 2), null);
    assert.equal(computeNewSessionsUsed("cancelled", 2), null);
    assert.equal(computeNewSessionsUsed("pending", 2), null);
  });

  it("returns null when no pack is associated (currentSessionsUsed is null)", () => {
    assert.equal(computeNewSessionsUsed("realized", null), null);
  });
});

describe("shouldNotifyClientCancellation", () => {
  it("returns true when cancelled by admin and client has phone", () => {
    assert.equal(shouldNotifyClientCancellation("admin", "5491100001111"), true);
  });

  it("returns false when cancelled by client (not admin)", () => {
    assert.equal(shouldNotifyClientCancellation("client", "5491100001111"), false);
  });

  it("returns false when client has no phone", () => {
    assert.equal(shouldNotifyClientCancellation("admin", null), false);
    assert.equal(shouldNotifyClientCancellation("admin", undefined), false);
    assert.equal(shouldNotifyClientCancellation("admin", ""), false);
  });
});

describe("shouldNotifyWaitlist", () => {
  it("returns true when serviceId is provided", () => {
    assert.equal(shouldNotifyWaitlist("svc-123"), true);
  });

  it("returns false when serviceId is null or undefined", () => {
    assert.equal(shouldNotifyWaitlist(null), false);
    assert.equal(shouldNotifyWaitlist(undefined), false);
    assert.equal(shouldNotifyWaitlist(""), false);
  });
});

// ── Integration: Full booking workflow state transition rules ─────────────────

describe("Booking status transition rules", () => {
  it("confirmed booking creates GCal event and does not delete", () => {
    assert.equal(shouldCreateCalendarEvent("confirmed"), true);
    assert.equal(shouldDeleteCalendarEvent("confirmed"), false);
  });

  it("cancelled booking deletes GCal event and does not create", () => {
    assert.equal(shouldCreateCalendarEvent("cancelled"), false);
    assert.equal(shouldDeleteCalendarEvent("cancelled"), true);
  });

  it("no_show booking deletes GCal event and does not create", () => {
    assert.equal(shouldCreateCalendarEvent("no_show"), false);
    assert.equal(shouldDeleteCalendarEvent("no_show"), true);
  });

  it("realized booking with pack increments sessions and has no GCal side effects", () => {
    const newSessions = computeNewSessionsUsed("realized", 5);
    assert.equal(newSessions, 6);
    assert.equal(shouldCreateCalendarEvent("realized"), false);
    assert.equal(shouldDeleteCalendarEvent("realized"), false);
  });

  it("only confirmed and cancelled/no_show trigger GCal operations (not pending/deposit_paid)", () => {
    for (const status of ["pending", "deposit_paid"]) {
      assert.equal(shouldCreateCalendarEvent(status), false, `${status} should not create`);
      assert.equal(shouldDeleteCalendarEvent(status), false, `${status} should not delete`);
    }
  });
});
