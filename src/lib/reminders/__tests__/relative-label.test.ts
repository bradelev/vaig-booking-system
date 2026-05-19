import { describe, it, expect } from "vitest";
import { relativeDayLabel } from "../relative-label";

const TZ = "America/Montevideo";

// "Now" anchored to 2026-05-19T13:00:00 Uruguay (= 2026-05-19T16:00:00Z, UYT UTC-3)
const NOW = new Date("2026-05-19T16:00:00.000Z");

describe("relativeDayLabel", () => {
  it("returns Hoy when booking is same calendar day", () => {
    // 15:00 Uruguay same day
    const scheduled = "2026-05-19T18:00:00.000Z";
    const result = relativeDayLabel(scheduled, TZ, NOW);
    expect(result.label).toBe("Hoy");
    expect(result.clauseEs).toBe("hoy a las 15:00");
  });

  it("returns Mañana when booking is next calendar day", () => {
    // 10:00 Uruguay next day
    const scheduled = "2026-05-20T13:00:00.000Z";
    const result = relativeDayLabel(scheduled, TZ, NOW);
    expect(result.label).toBe("Mañana");
    expect(result.clauseEs).toBe("mañana a las 10:00");
  });

  it("returns weekday + DD/MM for booking in 2 days", () => {
    // 2026-05-21 is a Thursday (jueves)
    const scheduled = "2026-05-21T14:00:00.000Z";
    const result = relativeDayLabel(scheduled, TZ, NOW);
    expect(result.label).toBe("Jueves 21/05");
    expect(result.clauseEs).toBe("el jueves 21/05 a las 11:00");
  });

  it("returns weekday + DD/MM for booking in 6 days", () => {
    // 2026-05-25 is a Monday (lunes)
    const scheduled = "2026-05-25T15:00:00.000Z";
    const result = relativeDayLabel(scheduled, TZ, NOW);
    expect(result.label).toBe("Lunes 25/05");
    expect(result.clauseEs).toContain("el lunes 25/05");
  });

  it("includes year suffix when booking is in a different year", () => {
    const scheduled = "2027-01-01T14:00:00.000Z";
    const result = relativeDayLabel(scheduled, TZ, NOW);
    expect(result.label).toContain("2027");
    expect(result.clauseEs).toContain("2027");
  });

  it("pads hours and minutes with leading zeros", () => {
    // 09:05 Uruguay
    const scheduled = "2026-05-19T12:05:00.000Z";
    const result = relativeDayLabel(scheduled, TZ, NOW);
    expect(result.clauseEs).toContain("09:05");
  });

  it("handles midnight booking (00:00 local)", () => {
    // midnight Uruguay = 03:00 UTC same day
    const scheduled = "2026-05-20T03:00:00.000Z";
    const result = relativeDayLabel(scheduled, TZ, NOW);
    expect(result.label).toBe("Mañana");
    expect(result.clauseEs).toContain("00:00");
  });
});
