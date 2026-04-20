import { describe, it, expect } from "vitest";
import type { SegmentationFilterCriteria } from "../segmentacion";

// --- Pure helpers mirrored from segmentacion components ---

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("598")) return `+${digits}`;
  if (digits.startsWith("09") || digits.startsWith("0")) return `+598${digits.slice(1)}`;
  return `+598${digits}`;
}

function hasAnyCriteria(c: SegmentationFilterCriteria) {
  return (
    (c.segmentos?.length ?? 0) > 0 ||
    (c.categorias?.length ?? 0) > 0 ||
    (c.serviceCategories?.length ?? 0) > 0 ||
    c.totalSesionesMin != null ||
    c.totalSesionesMax != null ||
    c.diasInactivoMin != null ||
    c.diasInactivoMax != null ||
    c.ticketPromedioMin != null ||
    c.ticketPromedioMax != null ||
    (c.sources?.length ?? 0) > 0 ||
    c.soloOportunidadCrossSell === true ||
    c.soloCandidataReactivacion === true
  );
}

describe("normalizePhone", () => {
  it("leaves +598 numbers as-is (stripped of non-digits)", () => {
    expect(normalizePhone("598 99 123 456")).toBe("+59899123456");
  });

  it("prepends +598 to local 09xxxxxxxx numbers", () => {
    expect(normalizePhone("099123456")).toBe("+59899123456");
  });

  it("prepends +598 to numbers starting with 0", () => {
    expect(normalizePhone("099 123 456")).toBe("+59899123456");
  });

  it("prepends +598 to bare 8-digit numbers", () => {
    expect(normalizePhone("99123456")).toBe("+59899123456");
  });

  it("strips non-numeric chars before processing", () => {
    expect(normalizePhone("+598-99-123-456")).toBe("+59899123456");
  });
});

describe("hasAnyCriteria", () => {
  it("returns false for empty criteria", () => {
    expect(hasAnyCriteria({})).toBe(false);
  });

  it("returns true when segmentos is set", () => {
    expect(hasAnyCriteria({ segmentos: ["S1"] })).toBe(true);
  });

  it("returns true when totalSesionesMin is 0", () => {
    expect(hasAnyCriteria({ totalSesionesMin: 0 })).toBe(true);
  });

  it("returns true when ticketPromedioMax is set", () => {
    expect(hasAnyCriteria({ ticketPromedioMax: 5000 })).toBe(true);
  });

  it("returns true when sources has values", () => {
    expect(hasAnyCriteria({ sources: ["koobing"] })).toBe(true);
  });

  it("returns true when soloOportunidadCrossSell is true", () => {
    expect(hasAnyCriteria({ soloOportunidadCrossSell: true })).toBe(true);
  });

  it("returns true when soloCandidataReactivacion is true", () => {
    expect(hasAnyCriteria({ soloCandidataReactivacion: true })).toBe(true);
  });

  it("returns false when boolean flags are false/undefined", () => {
    expect(hasAnyCriteria({ soloOportunidadCrossSell: false })).toBe(false);
  });

  it("returns false for empty arrays", () => {
    expect(hasAnyCriteria({ segmentos: [], sources: [] })).toBe(false);
  });
});
