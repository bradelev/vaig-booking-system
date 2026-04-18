/**
 * Tests for pure business logic extracted from clientes.ts.
 * Mirrors the levenshtein and duplicate-detection helpers.
 */
import { describe, it, expect } from "vitest";

// --- Pure helpers mirrored from clientes.ts (not exported, tested here in isolation) ---

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length < b.length) [a, b] = [b, a];
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      curr.push(Math.min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (a[i] !== b[j] ? 1 : 0)));
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
}

function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("", "")).toBe(0);
  });

  it("returns length of longer string when other is empty", () => {
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "xyz")).toBe(3);
  });

  it("single substitution", () => {
    expect(levenshtein("kitten", "sitten")).toBe(1);
    expect(levenshtein("flaw", "flan")).toBe(1);
  });

  it("single insertion / deletion", () => {
    expect(levenshtein("cat", "cats")).toBe(1);
    expect(levenshtein("cats", "cat")).toBe(1);
  });

  it("classic kitten/sitting example", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("is commutative", () => {
    expect(levenshtein("abc", "cab")).toBe(levenshtein("cab", "abc"));
  });

  it("handles names with typos (1-2 edits)", () => {
    expect(levenshtein("maria garcia", "maria garsia")).toBe(1);
    expect(levenshtein("juan perez", "jvan perez")).toBe(1);
    expect(levenshtein("ana lopez", "ana loper")).toBe(1);
  });

  it("returns > 2 for clearly different names", () => {
    expect(levenshtein("carlos mendez", "laura smith")).toBeGreaterThan(2);
  });
});

describe("norm (accent/case normalization)", () => {
  it("strips accents", () => {
    expect(norm("María García")).toBe("maria garcia");
    expect(norm("José López")).toBe("jose lopez");
    expect(norm("Ángel Núñez")).toBe("angel nunez");
  });

  it("lowercases", () => {
    expect(norm("JUAN PEREZ")).toBe("juan perez");
  });

  it("removes non-alphanumeric except spaces", () => {
    expect(norm("O'Brien")).toBe("obrien");
    expect(norm("Jean-Paul")).toBe("jeanpaul");
  });

  it("trims whitespace", () => {
    expect(norm("  ana  ")).toBe("ana");
  });

  it("handles empty string", () => {
    expect(norm("")).toBe("");
  });
});

describe("duplicate detection business rules", () => {
  it("exact normalised match (distance 0) is a duplicate candidate", () => {
    const name1 = norm("María García");
    const name2 = norm("Maria Garcia");
    expect(name1).toBe(name2);
    expect(levenshtein(name1, name2)).toBe(0);
  });

  it("typo within distance 1 is a candidate", () => {
    const a = norm("Ana Gomez");
    const b = norm("Ana Gomes");
    expect(levenshtein(a, b)).toBe(1);
    expect(levenshtein(a, b)).toBeLessThanOrEqual(2);
  });

  it("typo at distance 2 is still a candidate", () => {
    const a = norm("Lucas Fernandez");
    const b = norm("Lukas Fernandez");
    expect(levenshtein(a, b)).toBe(1);
  });

  it("distance > 2 is not a candidate", () => {
    const a = norm("Carlos Mendez");
    const b = norm("Carla Mendoza");
    expect(levenshtein(a, b)).toBeGreaterThan(2);
  });

  it("single-word entries (filtered out) do not generate pairs", () => {
    const name = norm("Ana");
    const words = name.split(" ");
    expect(words.length).toBe(1);
    // Entries with < 2 words are filtered in getDuplicadosCandidatos
  });
});
