import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseUserDateTimeRegex, parseSmartDateTime } from "../date-parser";
import { getARTComponents } from "@/lib/timezone";

// Fix "now" to a known Monday (2026-04-20 = Monday in ART)
// We use UTC noon so ART = Monday
const FIXED_NOW = new Date("2026-04-20T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function artHour(date: Date): number {
  return getARTComponents(date).hour;
}
function artMinute(date: Date): number {
  return getARTComponents(date).minute;
}
function artDay(date: Date): number {
  return getARTComponents(date).day;
}

describe("parseUserDateTimeRegex — time formats", () => {
  it("parses HH:MM colon format", () => {
    const result = parseUserDateTimeRegex("quiero a las 15:30");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(15);
    expect(artMinute(result!)).toBe(30);
  });

  it("parses AM/PM format — 3pm → 15:00", () => {
    const result = parseUserDateTimeRegex("a las 3pm");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(15);
    expect(artMinute(result!)).toBe(0);
  });

  it("parses AM/PM format — 10am → 10:00", () => {
    const result = parseUserDateTimeRegex("a las 10am");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(10);
  });

  it("parses 12pm as noon (12:00)", () => {
    const result = parseUserDateTimeRegex("12pm");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(12);
  });

  it("parses 12am as midnight (0:00)", () => {
    const result = parseUserDateTimeRegex("12am");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(0);
  });

  it("parses 'hs' suffix — 10hs → 10:00", () => {
    const result = parseUserDateTimeRegex("a las 10hs");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(10);
  });

  it("parses 'a las N' pattern", () => {
    const result = parseUserDateTimeRegex("a las 9");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(9);
  });
});

describe("parseUserDateTimeRegex — business hours heuristic", () => {
  it("bare hour 5 (no am/pm) → 17:00 (PM heuristic)", () => {
    const result = parseUserDateTimeRegex("quiero turno a las 5");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(17);
  });

  it("bare hour 8 → 20:00 (PM heuristic)", () => {
    const result = parseUserDateTimeRegex("a las 8");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(20);
  });

  it("bare hour 9 → stays 9 (no PM heuristic above 8)", () => {
    const result = parseUserDateTimeRegex("a las 9hs");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(9);
  });

  it("hour with colon (10:00) → no PM heuristic applied", () => {
    const result = parseUserDateTimeRegex("a las 10:00");
    expect(result).not.toBeNull();
    expect(artHour(result!)).toBe(10);
  });
});

describe("parseUserDateTimeRegex — date keywords", () => {
  it("'hoy' → today's date (Monday 20)", () => {
    const result = parseUserDateTimeRegex("hoy a las 10:00");
    expect(result).not.toBeNull();
    expect(artDay(result!)).toBe(20);
  });

  it("'mañana' → tomorrow (Tuesday 21)", () => {
    const result = parseUserDateTimeRegex("mañana a las 10:00");
    expect(result).not.toBeNull();
    expect(artDay(result!)).toBe(21);
  });

  it("'pasado' → day after tomorrow (Wednesday 22)", () => {
    const result = parseUserDateTimeRegex("pasado a las 10:00");
    expect(result).not.toBeNull();
    expect(artDay(result!)).toBe(22);
  });

  it("'martes' when today is Monday → next Tuesday (21)", () => {
    const result = parseUserDateTimeRegex("martes a las 10:00");
    expect(result).not.toBeNull();
    expect(artDay(result!)).toBe(21);
  });

  it("'lunes' when today is Monday → next Monday (27, not today)", () => {
    const result = parseUserDateTimeRegex("lunes a las 10:00");
    expect(result).not.toBeNull();
    expect(artDay(result!)).toBe(27);
  });

  it("parses dd/mm date format", () => {
    const result = parseUserDateTimeRegex("el 25/04 a las 10:00");
    expect(result).not.toBeNull();
    expect(artDay(result!)).toBe(25);
  });
});

describe("parseUserDateTimeRegex — returns null", () => {
  it("returns null for text with no time info", () => {
    expect(parseUserDateTimeRegex("hola quiero un turno")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseUserDateTimeRegex("")).toBeNull();
  });

  it("returns null for pure day name without time", () => {
    expect(parseUserDateTimeRegex("martes")).toBeNull();
  });
});

describe("parseSmartDateTime — source tagging", () => {
  it("returns source=regex when regex succeeds", async () => {
    const result = await parseSmartDateTime("a las 15:00");
    expect(result).not.toBeNull();
    expect(result!.source).toBe("regex");
  });

  it("returns null when no API key and regex fails", async () => {
    const orig = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const result = await parseSmartDateTime("el próximo miércoles");
    expect(result).toBeNull();
    process.env.ANTHROPIC_API_KEY = orig;
  });
});
