/**
 * Tests for the sessions_used guard logic (VBS-216).
 *
 * The guard prevents incrementing sessions_used past sessions_total,
 * enforcing the same constraint as the DB CHECK constraint
 * sessions_used_valid at the application level.
 */
import { describe, it, expect } from "vitest";

// --- Pure helper mirroring the guard logic in citas.ts and sesiones.ts ---

/**
 * Returns true if the sessions_used counter should be incremented,
 * false if it is already at or beyond the cap.
 * Mirrors the guard added in updateBookingStatus, updateBookingInline,
 * and confirmBookingAsSession.
 */
function shouldIncrementSessionsUsed(
  sessionsUsed: number,
  sessionsTotal: number
): boolean {
  return sessionsUsed < sessionsTotal;
}

/**
 * Simulates the full guard + increment logic.
 * Returns the resulting sessions_used value (unchanged if at cap).
 */
function applySessionsUsedGuard(
  sessionsUsed: number,
  sessionsTotal: number
): { incremented: boolean; newSessionsUsed: number } {
  if (sessionsUsed >= sessionsTotal) {
    return { incremented: false, newSessionsUsed: sessionsUsed };
  }
  return { incremented: true, newSessionsUsed: sessionsUsed + 1 };
}

// --- Tests ---

describe("shouldIncrementSessionsUsed", () => {
  it("returns true when sessions_used is below sessions_total", () => {
    expect(shouldIncrementSessionsUsed(0, 10)).toBe(true);
    expect(shouldIncrementSessionsUsed(4, 5)).toBe(true);
    expect(shouldIncrementSessionsUsed(9, 10)).toBe(true);
  });

  it("returns false when sessions_used equals sessions_total (at cap)", () => {
    expect(shouldIncrementSessionsUsed(5, 5)).toBe(false);
    expect(shouldIncrementSessionsUsed(10, 10)).toBe(false);
    expect(shouldIncrementSessionsUsed(1, 1)).toBe(false);
  });

  it("returns false when sessions_used exceeds sessions_total (over cap)", () => {
    expect(shouldIncrementSessionsUsed(6, 5)).toBe(false);
    expect(shouldIncrementSessionsUsed(11, 10)).toBe(false);
  });
});

describe("applySessionsUsedGuard", () => {
  it("increments when sessions_used is below total", () => {
    const result = applySessionsUsedGuard(3, 10);
    expect(result.incremented).toBe(true);
    expect(result.newSessionsUsed).toBe(4);
  });

  it("increments from 0 to 1", () => {
    const result = applySessionsUsedGuard(0, 5);
    expect(result.incremented).toBe(true);
    expect(result.newSessionsUsed).toBe(1);
  });

  it("does not increment when sessions_used equals sessions_total", () => {
    const result = applySessionsUsedGuard(5, 5);
    expect(result.incremented).toBe(false);
    expect(result.newSessionsUsed).toBe(5);
  });

  it("does not increment when sessions_used exceeds sessions_total", () => {
    const result = applySessionsUsedGuard(7, 5);
    expect(result.incremented).toBe(false);
    expect(result.newSessionsUsed).toBe(7);
  });

  it("handles single-session pack at cap", () => {
    const result = applySessionsUsedGuard(1, 1);
    expect(result.incremented).toBe(false);
    expect(result.newSessionsUsed).toBe(1);
  });

  it("handles single-session pack not yet used", () => {
    const result = applySessionsUsedGuard(0, 1);
    expect(result.incremented).toBe(true);
    expect(result.newSessionsUsed).toBe(1);
  });
});

describe("DB constraint boundary conditions", () => {
  it("guard allows last valid increment (sessions_used + 1 == sessions_total)", () => {
    // e.g. pack of 10, used 9 — the 10th session is valid
    const result = applySessionsUsedGuard(9, 10);
    expect(result.incremented).toBe(true);
    expect(result.newSessionsUsed).toBe(10);
    // After this, sessions_used == sessions_total (still valid per CHECK constraint)
  });

  it("guard blocks increment that would violate CHECK constraint", () => {
    // sessions_used == sessions_total — incrementing would produce sessions_used > sessions_total
    const result = applySessionsUsedGuard(10, 10);
    expect(result.incremented).toBe(false);
    expect(result.newSessionsUsed).toBe(10);
  });
});
