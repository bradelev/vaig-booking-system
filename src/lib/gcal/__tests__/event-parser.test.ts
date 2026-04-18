import { describe, it, expect } from "vitest";
import { parseEventSummary } from "../event-parser";

describe("parseEventSummary — system events", () => {
  it("marks VAIG: prefix as system-created", () => {
    const result = parseEventSummary("VAIG: Depilacion laser Maria");
    expect(result.isSystemCreated).toBe(true);
    expect(result.clientName).toBe("");
    expect(result.abbreviations).toEqual([]);
  });

  it("handles empty summary", () => {
    const result = parseEventSummary("");
    expect(result.isSystemCreated).toBe(false);
    expect(result.clientName).toBe("");
    expect(result.abbreviations).toEqual([]);
  });

  it("handles whitespace-only summary", () => {
    const result = parseEventSummary("   ");
    expect(result.isSystemCreated).toBe(false);
    expect(result.clientName).toBe("");
  });
});

describe("parseEventSummary — single token", () => {
  it("returns title-cased name with no abbreviations for single word", () => {
    const result = parseEventSummary("maria");
    expect(result.clientName).toBe("Maria");
    expect(result.abbreviations).toEqual([]);
    expect(result.isSystemCreated).toBe(false);
  });
});

describe("parseEventSummary — 2 tokens", () => {
  it("treats two words as first+last name when second is not an abbreviation", () => {
    const result = parseEventSummary("Maria Garcia");
    expect(result.clientName).toBe("Maria Garcia");
    expect(result.abbreviations).toEqual([]);
  });

  it("treats second token as abbreviation when it is a known abbrev", () => {
    // "ax" is axila — a known abbreviation
    const result = parseEventSummary("Maria ax");
    expect(result.clientName).toBe("Maria");
    expect(result.abbreviations).toContain("ax");
  });
});

describe("parseEventSummary — multiple tokens", () => {
  it("picks 1-word name when remaining tokens are all abbreviations", () => {
    // "Maria ax bk" — ax=axila, bk=bikini
    const result = parseEventSummary("Maria ax bk");
    expect(result.clientName).toBe("Maria");
    expect(result.abbreviations).toContain("ax");
    expect(result.abbreviations).toContain("bk");
  });

  it("picks 2-word name when remaining tokens are all abbreviations", () => {
    // "Maria Garcia ax bk" — 2-word name + 2 abbrevs → better score than 1-word + 3 tokens
    const result = parseEventSummary("Maria Garcia ax bk");
    expect(result.clientName).toBe("Maria Garcia");
    expect(result.abbreviations).toContain("ax");
    expect(result.abbreviations).toContain("bk");
  });

  it("title-cases client name correctly", () => {
    const result = parseEventSummary("JUAN PEREZ ax");
    expect(result.clientName).toBe("Juan Perez");
  });

  it("returns abbreviations in lowercase", () => {
    const result = parseEventSummary("Maria AX BK");
    expect(result.abbreviations.every((a) => a === a.toLowerCase())).toBe(true);
  });

  it("includes unknown tokens when 1-word name has more abbrev matches", () => {
    // "Maria ax bk xyz" — scoreA: [ax,bk,xyz]=2 matches; scoreB: [bk,xyz]=1 match → 1-word wins
    const result = parseEventSummary("Maria ax bk xyz");
    expect(result.clientName).toBe("Maria");
    expect(result.abbreviations).toContain("ax");
    expect(result.abbreviations).toContain("bk");
    expect(result.abbreviations).toContain("xyz");
  });
});
