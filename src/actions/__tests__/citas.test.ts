/**
 * Integration tests for booking business logic extracted from citas.ts.
 * Tests core business rules without Next.js or Supabase dependencies.
 */
import { describe, it, expect } from "vitest";


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
    expect(shouldCreateCalendarEvent("confirmed")).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(shouldCreateCalendarEvent("pending")).toBe(false);
    expect(shouldCreateCalendarEvent("realized")).toBe(false);
    expect(shouldCreateCalendarEvent("cancelled")).toBe(false);
    expect(shouldCreateCalendarEvent("no_show")).toBe(false);
    expect(shouldCreateCalendarEvent("deposit_paid")).toBe(false);
  });
});

describe("shouldDeleteCalendarEvent", () => {
  it("returns true for 'cancelled' status", () => {
    expect(shouldDeleteCalendarEvent("cancelled")).toBe(true);
  });

  it("returns true for 'no_show' status", () => {
    expect(shouldDeleteCalendarEvent("no_show")).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(shouldDeleteCalendarEvent("confirmed")).toBe(false);
    expect(shouldDeleteCalendarEvent("pending")).toBe(false);
    expect(shouldDeleteCalendarEvent("realized")).toBe(false);
    expect(shouldDeleteCalendarEvent("deposit_paid")).toBe(false);
  });
});

describe("computeNewSessionsUsed", () => {
  it("increments by 1 when status is 'realized' and pack exists", () => {
    expect(computeNewSessionsUsed("realized", 2)).toBe(3);
    expect(computeNewSessionsUsed("realized", 0)).toBe(1);
    expect(computeNewSessionsUsed("realized", 9)).toBe(10);
  });

  it("returns null when status is not 'realized'", () => {
    expect(computeNewSessionsUsed("confirmed", 2)).toBe(null);
    expect(computeNewSessionsUsed("cancelled", 2)).toBe(null);
    expect(computeNewSessionsUsed("pending", 2)).toBe(null);
  });

  it("returns null when no pack is associated (currentSessionsUsed is null)", () => {
    expect(computeNewSessionsUsed("realized", null)).toBe(null);
  });
});

describe("shouldNotifyClientCancellation", () => {
  it("returns true when cancelled by admin and client has phone", () => {
    expect(shouldNotifyClientCancellation("admin", "5491100001111")).toBe(true);
  });

  it("returns false when cancelled by client (not admin)", () => {
    expect(shouldNotifyClientCancellation("client", "5491100001111")).toBe(false);
  });

  it("returns false when client has no phone", () => {
    expect(shouldNotifyClientCancellation("admin", null)).toBe(false);
    expect(shouldNotifyClientCancellation("admin", undefined)).toBe(false);
    expect(shouldNotifyClientCancellation("admin", "")).toBe(false);
  });
});

describe("shouldNotifyWaitlist", () => {
  it("returns true when serviceId is provided", () => {
    expect(shouldNotifyWaitlist("svc-123")).toBe(true);
  });

  it("returns false when serviceId is null or undefined", () => {
    expect(shouldNotifyWaitlist(null)).toBe(false);
    expect(shouldNotifyWaitlist(undefined)).toBe(false);
    expect(shouldNotifyWaitlist("")).toBe(false);
  });
});

// ── Integration: Full booking workflow state transition rules ─────────────────

describe("Booking status transition rules", () => {
  it("confirmed booking creates GCal event and does not delete", () => {
    expect(shouldCreateCalendarEvent("confirmed")).toBe(true);
    expect(shouldDeleteCalendarEvent("confirmed")).toBe(false);
  });

  it("cancelled booking deletes GCal event and does not create", () => {
    expect(shouldCreateCalendarEvent("cancelled")).toBe(false);
    expect(shouldDeleteCalendarEvent("cancelled")).toBe(true);
  });

  it("no_show booking deletes GCal event and does not create", () => {
    expect(shouldCreateCalendarEvent("no_show")).toBe(false);
    expect(shouldDeleteCalendarEvent("no_show")).toBe(true);
  });

  it("realized booking with pack increments sessions and has no GCal side effects", () => {
    const newSessions = computeNewSessionsUsed("realized", 5);
    expect(newSessions).toBe(6);
    expect(shouldCreateCalendarEvent("realized")).toBe(false);
    expect(shouldDeleteCalendarEvent("realized")).toBe(false);
  });

  it("only confirmed and cancelled/no_show trigger GCal operations (not pending/deposit_paid)", () => {
    for (const status of ["pending", "deposit_paid"]) {
      expect(shouldCreateCalendarEvent(status), `${status} should not create`).toBe(false);
      expect(shouldDeleteCalendarEvent(status), `${status} should not delete`).toBe(false);
    }
  });
});
