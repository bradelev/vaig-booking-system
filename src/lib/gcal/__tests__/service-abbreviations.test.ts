import { describe, it, expect } from "vitest";
import { matchServicesToAbbreviations, ABBREVIATION_MAP } from "../service-abbreviations";

const DB_SERVICES = [
  { id: "s1", name: "Depilación Láser Axila" },
  { id: "s2", name: "Masaje Terapeutico" },
  { id: "s3", name: "Limpieza Facial" },
  { id: "s4", name: "Bikini Completo" },
  { id: "s5", name: "Pedicuria Semipermanente" },
  { id: "s6", name: "Hifu Facial" },
];

describe("ABBREVIATION_MAP", () => {
  it("contains core service categories", () => {
    expect(ABBREVIATION_MAP["ax"]).toBeDefined();
    expect(ABBREVIATION_MAP["mt"]).toBeDefined();
    expect(ABBREVIATION_MAP["lc"]).toBeDefined();
    expect(ABBREVIATION_MAP["hifu"]).toBeDefined();
  });

  it("all values are non-empty arrays of strings", () => {
    for (const [key, vals] of Object.entries(ABBREVIATION_MAP)) {
      expect(Array.isArray(vals), `${key} should be array`).toBe(true);
      expect(vals.length, `${key} should be non-empty`).toBeGreaterThan(0);
      vals.forEach((v) => expect(typeof v).toBe("string"));
    }
  });
});

describe("matchServicesToAbbreviations — exact match", () => {
  it("matches 'ax' → Depilación Láser Axila with exact confidence", () => {
    const results = matchServicesToAbbreviations(["ax"], DB_SERVICES);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe("exact");
    expect(results[0].serviceId).toBe("s1");
    expect(results[0].abbreviation).toBe("ax");
  });

  it("matches 'mt' → Masaje Terapeutico with exact confidence", () => {
    const results = matchServicesToAbbreviations(["mt"], DB_SERVICES);
    expect(results[0].confidence).toBe("exact");
    expect(results[0].serviceId).toBe("s2");
  });

  it("matches 'lc' → Limpieza Facial with exact confidence", () => {
    const results = matchServicesToAbbreviations(["lc"], DB_SERVICES);
    expect(results[0].confidence).toBe("exact");
    expect(results[0].serviceId).toBe("s3");
  });

  it("matches 'hifu' → Hifu Facial with exact confidence", () => {
    const results = matchServicesToAbbreviations(["hifu"], DB_SERVICES);
    expect(results[0].confidence).toBe("exact");
    expect(results[0].serviceId).toBe("s6");
  });

  it("handles multiple abbreviations in one call", () => {
    const results = matchServicesToAbbreviations(["ax", "mt"], DB_SERVICES);
    expect(results).toHaveLength(2);
    expect(results[0].serviceId).toBe("s1");
    expect(results[1].serviceId).toBe("s2");
  });
});

describe("matchServicesToAbbreviations — unmatched", () => {
  it("returns unmatched for unknown abbreviation", () => {
    const results = matchServicesToAbbreviations(["zzz"], DB_SERVICES);
    expect(results[0].confidence).toBe("unmatched");
    expect(results[0].serviceId).toBe("");
  });

  it("returns unmatched when no services provided", () => {
    const results = matchServicesToAbbreviations(["ax"], []);
    // No DB services → fuzzy match can't find anything within threshold
    expect(results[0].confidence).toBe("unmatched");
  });

  it("returns empty array for empty abbreviations list", () => {
    const results = matchServicesToAbbreviations([], DB_SERVICES);
    expect(results).toHaveLength(0);
  });
});

describe("matchServicesToAbbreviations — case insensitivity", () => {
  it("matches uppercase abbreviation", () => {
    const results = matchServicesToAbbreviations(["AX"], DB_SERVICES);
    expect(results[0].confidence).toBe("exact");
    expect(results[0].serviceId).toBe("s1");
  });

  it("matches mixed-case abbreviation", () => {
    const results = matchServicesToAbbreviations(["Mt"], DB_SERVICES);
    expect(results[0].confidence).toBe("exact");
    expect(results[0].serviceId).toBe("s2");
  });
});
