import { describe, it, expect } from "vitest";
import { artLocalInputToISO, dateToARTLocalInput } from "@/lib/timezone";

describe("artLocalInputToISO", () => {
  it("converts 11:00 ART to 14:00 UTC ISO", () => {
    expect(artLocalInputToISO("2026-04-19T11:00")).toBe("2026-04-19T14:00:00.000Z");
  });

  it("handles midnight ART → 03:00 UTC next-day-friendly", () => {
    expect(artLocalInputToISO("2026-04-19T00:00")).toBe("2026-04-19T03:00:00.000Z");
  });

  it("handles late-evening ART that crosses UTC day boundary", () => {
    expect(artLocalInputToISO("2026-04-19T22:30")).toBe("2026-04-20T01:30:00.000Z");
  });
});

describe("dateToARTLocalInput", () => {
  it("formats a UTC Date back to ART YYYY-MM-DDTHH:mm", () => {
    const utcDate = new Date("2026-04-19T14:00:00.000Z");
    expect(dateToARTLocalInput(utcDate)).toBe("2026-04-19T11:00");
  });

  it("is the inverse of artLocalInputToISO", () => {
    const input = "2026-07-01T09:30";
    const roundTripped = dateToARTLocalInput(new Date(artLocalInputToISO(input)));
    expect(roundTripped).toBe(input);
  });

  it("handles boundary crossing from UTC back to ART", () => {
    const utcDate = new Date("2026-04-20T01:30:00.000Z");
    expect(dateToARTLocalInput(utcDate)).toBe("2026-04-19T22:30");
  });
});
