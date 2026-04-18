/**
 * Tests for pure business logic extracted from sesiones.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Pure helpers mirrored from sesiones.ts ---

function isSearchQueryTooShort(query: string): boolean {
  return query.trim().length < 2;
}

function buildScheduledAtFromOverrides(
  fecha: string,
  hora: string
): string {
  return new Date(`${fecha}T${hora}:00-03:00`).toISOString();
}

function getDateFromScheduledAt(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function computeNextSessionN(sessionsUsed: number | null | undefined): number | null {
  if (sessionsUsed == null) return null;
  return sessionsUsed + 1;
}

// --- Tests ---

describe("isSearchQueryTooShort", () => {
  it("returns true for empty string", () => {
    expect(isSearchQueryTooShort("")).toBe(true);
  });

  it("returns true for single character", () => {
    expect(isSearchQueryTooShort("a")).toBe(true);
  });

  it("returns true for whitespace-only", () => {
    expect(isSearchQueryTooShort("  ")).toBe(true);
  });

  it("returns false for 2+ chars", () => {
    expect(isSearchQueryTooShort("an")).toBe(false);
    expect(isSearchQueryTooShort("ana")).toBe(false);
    expect(isSearchQueryTooShort("juan perez")).toBe(false);
  });
});

describe("buildScheduledAtFromOverrides", () => {
  it("converts ART date+time to UTC ISO string", () => {
    const result = buildScheduledAtFromOverrides("2026-04-20", "10:00");
    // 10:00 ART (UTC-3) = 13:00 UTC
    expect(result).toBe("2026-04-20T13:00:00.000Z");
  });

  it("handles midnight ART", () => {
    const result = buildScheduledAtFromOverrides("2026-04-20", "00:00");
    // 00:00 ART = 03:00 UTC
    expect(result).toBe("2026-04-20T03:00:00.000Z");
  });

  it("handles late evening ART", () => {
    const result = buildScheduledAtFromOverrides("2026-04-20", "21:00");
    // 21:00 ART = 00:00 UTC next day
    expect(result).toBe("2026-04-21T00:00:00.000Z");
  });
});

describe("getDateFromScheduledAt", () => {
  it("extracts ART date from UTC timestamp", () => {
    // 2026-04-20T03:00:00Z = midnight ART
    expect(getDateFromScheduledAt("2026-04-20T03:00:00.000Z")).toBe("2026-04-20");
  });

  it("handles late UTC time that is still same ART day", () => {
    // 2026-04-20T23:00:00Z = 20:00 ART = still Apr 20
    expect(getDateFromScheduledAt("2026-04-20T23:00:00.000Z")).toBe("2026-04-20");
  });

  it("handles UTC time that crosses to next ART day", () => {
    // 2026-04-20T02:00:00Z = 23:00 ART Apr 19 = Apr 19
    expect(getDateFromScheduledAt("2026-04-20T02:00:00.000Z")).toBe("2026-04-19");
  });
});

describe("computeNextSessionN", () => {
  it("increments sessions_used to get next session number", () => {
    expect(computeNextSessionN(0)).toBe(1);
    expect(computeNextSessionN(4)).toBe(5);
  });

  it("returns null when sessions_used is null", () => {
    expect(computeNextSessionN(null)).toBe(null);
  });

  it("returns null when sessions_used is undefined", () => {
    expect(computeNextSessionN(undefined)).toBe(null);
  });
});

describe("sendReminders input validation", () => {
  it("detects invalid phone prefixes", () => {
    const isInvalidPhone = (phone: string) =>
      phone.startsWith("historico_") || phone.startsWith("migrated_nophone_");

    expect(isInvalidPhone("historico_abc")).toBe(true);
    expect(isInvalidPhone("migrated_nophone_xyz")).toBe(true);
    expect(isInvalidPhone("59899123456")).toBe(false);
    expect(isInvalidPhone("")).toBe(false);
  });

  it("detects empty bookingIds or message as invalid", () => {
    const isInvalid = (bookingIds: string[], message: string) =>
      !bookingIds.length || !message.trim();

    expect(isInvalid([], "hello")).toBe(true);
    expect(isInvalid(["id1"], "")).toBe(true);
    expect(isInvalid(["id1"], "   ")).toBe(true);
    expect(isInvalid(["id1"], "hello")).toBe(false);
  });
});
