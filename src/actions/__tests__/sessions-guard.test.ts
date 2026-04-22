/**
 * Tests for the sessions_used guard logic (VBS-216, VBS-225).
 *
 * Imports the real exported functions from src/lib/sessions-guard.ts.
 * Renaming a production function causes a compile error here — no mirror tests.
 */
import { describe, it, expect } from "vitest";
import { shouldIncrementSessionsUsed, applySessionsUsedGuard } from "@/lib/sessions-guard";

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
