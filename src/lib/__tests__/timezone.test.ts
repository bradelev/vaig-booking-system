import { describe, it, expect } from "vitest";
import { localInputToISO, dateToLocalInput, LOCAL_TIMEZONE } from "@/lib/timezone";

// Both America/Montevideo (UYT) and America/Argentina/Buenos_Aires (ART) are UTC-3 with no DST.
// These tests exercise the new generic helpers. The default TZ (LOCAL_TIMEZONE) is Montevideo.

describe("localInputToISO (default: America/Montevideo, UTC-3)", () => {
  it("converts 11:00 local to 14:00 UTC ISO", () => {
    expect(localInputToISO("2026-04-19T11:00")).toBe("2026-04-19T14:00:00.000Z");
  });

  it("handles midnight local → 03:00 UTC", () => {
    expect(localInputToISO("2026-04-19T00:00")).toBe("2026-04-19T03:00:00.000Z");
  });

  it("handles late-evening local that crosses UTC day boundary", () => {
    expect(localInputToISO("2026-04-19T22:30")).toBe("2026-04-20T01:30:00.000Z");
  });

  it("accepts an explicit Buenos Aires tz (same UTC-3)", () => {
    const tz = "America/Argentina/Buenos_Aires";
    expect(localInputToISO("2026-04-19T11:00", tz)).toBe("2026-04-19T14:00:00.000Z");
  });

  it("accepts an explicit UTC tz (zero offset)", () => {
    expect(localInputToISO("2026-04-19T14:00", "UTC")).toBe("2026-04-19T14:00:00.000Z");
  });
});

describe("dateToLocalInput (default: America/Montevideo, UTC-3)", () => {
  it("formats a UTC Date back to local YYYY-MM-DDTHH:mm", () => {
    const utcDate = new Date("2026-04-19T14:00:00.000Z");
    expect(dateToLocalInput(utcDate)).toBe("2026-04-19T11:00");
  });

  it("is the inverse of localInputToISO", () => {
    const input = "2026-07-01T09:30";
    const roundTripped = dateToLocalInput(new Date(localInputToISO(input)));
    expect(roundTripped).toBe(input);
  });

  it("handles boundary crossing from UTC back to local", () => {
    const utcDate = new Date("2026-04-20T01:30:00.000Z");
    expect(dateToLocalInput(utcDate)).toBe("2026-04-19T22:30");
  });

  it("formats correctly with explicit UTC tz", () => {
    const utcDate = new Date("2026-04-19T14:00:00.000Z");
    expect(dateToLocalInput(utcDate, "UTC")).toBe("2026-04-19T14:00");
  });
});

describe("LOCAL_TIMEZONE constant", () => {
  it("defaults to America/Montevideo", () => {
    expect(LOCAL_TIMEZONE).toBe("America/Montevideo");
  });
});

// Backward-compat aliases
describe("backward-compat aliases", () => {
  it("artLocalInputToISO re-exported as localInputToISO", async () => {
    const { artLocalInputToISO } = await import("@/lib/timezone");
    expect(artLocalInputToISO("2026-04-19T11:00")).toBe("2026-04-19T14:00:00.000Z");
  });

  it("dateToARTLocalInput re-exported as dateToLocalInput", async () => {
    const { dateToARTLocalInput } = await import("@/lib/timezone");
    expect(dateToARTLocalInput(new Date("2026-04-19T14:00:00.000Z"))).toBe("2026-04-19T11:00");
  });
});
