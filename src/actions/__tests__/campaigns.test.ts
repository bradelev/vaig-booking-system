/**
 * Tests for pure business logic extracted from campaigns.ts.
 */
import { describe, it, expect } from "vitest";
import type { CampaignFilterCriteria } from "../campaigns";

// --- Pure helpers mirrored from campaigns.ts ---

function parseFilterCriteria(raw: string | null): CampaignFilterCriteria | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CampaignFilterCriteria;
  } catch {
    return null;
  }
}

function parseCampaignScheduledAt(raw: string | null): string | null {
  if (!raw) return null;
  return new Date(`${raw}:00-03:00`).toISOString();
}

function isCampaignSchedulePast(scheduledAt: string, nowMs: number): boolean {
  return new Date(scheduledAt).getTime() < nowMs - 60_000;
}

function buildCloningName(originalName: string): string {
  return `${originalName} (copia)`;
}

// --- Tests ---

describe("parseFilterCriteria", () => {
  it("returns null for null input", () => {
    expect(parseFilterCriteria(null)).toBe(null);
  });

  it("returns null for empty string", () => {
    expect(parseFilterCriteria("")).toBe(null);
  });

  it("returns null for invalid JSON", () => {
    expect(parseFilterCriteria("not json")).toBe(null);
    expect(parseFilterCriteria("{broken")).toBe(null);
  });

  it("parses valid filter criteria", () => {
    const criteria: CampaignFilterCriteria = {
      segmentos: ["vip", "regular"],
      totalSesionesMin: 3,
    };
    expect(parseFilterCriteria(JSON.stringify(criteria))).toEqual(criteria);
  });

  it("parses empty object as valid criteria", () => {
    expect(parseFilterCriteria("{}")).toEqual({});
  });

  it("parses all criterion fields", () => {
    const criteria: CampaignFilterCriteria = {
      segmentos: ["vip"],
      categorias: ["depilacion"],
      serviceCategories: ["Depilación Láser"],
      totalSesionesMin: 1,
      totalSesionesMax: 10,
      diasInactivoMin: 30,
      diasInactivoMax: 90,
    };
    expect(parseFilterCriteria(JSON.stringify(criteria))).toEqual(criteria);
  });
});

describe("parseCampaignScheduledAt", () => {
  it("returns null for null input", () => {
    expect(parseCampaignScheduledAt(null)).toBe(null);
  });

  it("converts ART datetime to UTC ISO", () => {
    // 10:00 ART (UTC-3) = 13:00 UTC
    expect(parseCampaignScheduledAt("2026-04-20T10:00")).toBe("2026-04-20T13:00:00.000Z");
  });

  it("handles midnight ART", () => {
    expect(parseCampaignScheduledAt("2026-04-20T00:00")).toBe("2026-04-20T03:00:00.000Z");
  });
});

describe("isCampaignSchedulePast", () => {
  it("returns true when scheduled time is well in the past", () => {
    const scheduledAt = "2024-01-01T12:00:00.000Z";
    expect(isCampaignSchedulePast(scheduledAt, Date.now())).toBe(true);
  });

  it("returns false when scheduled time is in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(isCampaignSchedulePast(future, Date.now())).toBe(false);
  });

  it("returns false when scheduled time is within 1 minute tolerance", () => {
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
    expect(isCampaignSchedulePast(thirtySecondsAgo, Date.now())).toBe(false);
  });

  it("returns true when past the 1-minute tolerance", () => {
    const twoMinutesAgo = new Date(Date.now() - 120_000).toISOString();
    expect(isCampaignSchedulePast(twoMinutesAgo, Date.now())).toBe(true);
  });
});

describe("buildCloningName", () => {
  it("appends (copia) to original name", () => {
    expect(buildCloningName("Campaña verano")).toBe("Campaña verano (copia)");
  });

  it("works with already-cloned names", () => {
    expect(buildCloningName("Campaña verano (copia)")).toBe("Campaña verano (copia) (copia)");
  });

  it("works with empty string", () => {
    expect(buildCloningName("")).toBe(" (copia)");
  });
});

describe("CampaignFilterCriteria type structure", () => {
  it("all fields are optional", () => {
    const empty: CampaignFilterCriteria = {};
    expect(empty).toBeDefined();
  });

  it("accepts segmentos with none sentinel", () => {
    const criteria: CampaignFilterCriteria = { segmentos: ["none", "vip"] };
    const hasNone = criteria.segmentos?.includes("none") ?? false;
    const real = criteria.segmentos?.filter((s) => s !== "none") ?? [];
    expect(hasNone).toBe(true);
    expect(real).toEqual(["vip"]);
  });

  it("detects all-none segmentos filter", () => {
    const criteria: CampaignFilterCriteria = { segmentos: ["none"] };
    const hasNone = criteria.segmentos?.includes("none") ?? false;
    const real = criteria.segmentos?.filter((s) => s !== "none") ?? [];
    expect(hasNone).toBe(true);
    expect(real).toHaveLength(0);
  });
});
