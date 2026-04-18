import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatSlotLabel } from "../db";

// All dates given in UTC; ART = UTC-3
// 2026-03-23T13:00:00Z = Monday 10:00 ART
// 2026-03-24T17:00:00Z = Tuesday 14:00 ART
// 2026-03-21T17:00:00Z = Saturday 14:00 ART
// 2026-03-22T12:00:00Z = Sunday 09:00 ART
// 2026-03-31T15:00:00Z = Tuesday 12:00 ART (end of month)
// 2026-04-01T12:00:00Z = Wednesday 09:00 ART (start of April)

describe("formatSlotLabel", () => {
  it("formats a Monday slot correctly", () => {
    // 2026-03-23 10:00 ART
    const date = new Date("2026-03-23T13:00:00.000Z");
    const label = formatSlotLabel(date);
    assert.ok(label.includes("Lunes"), `Expected 'Lunes' in: ${label}`);
    // es-AR locale may format day/month without leading zeros (23/3)
    assert.ok(label.includes("23"), `Expected '23' (day) in: ${label}`);
    assert.ok(label.includes("3"), `Expected '3' (month) in: ${label}`);
    assert.ok(label.includes("10:00"), `Expected '10:00' in: ${label}`);
    assert.ok(label.includes("a las"), `Expected 'a las' in: ${label}`);
  });

  it("formats a Tuesday slot correctly", () => {
    // 2026-03-24 14:00 ART
    const date = new Date("2026-03-24T17:00:00.000Z");
    const label = formatSlotLabel(date);
    assert.ok(label.includes("Martes"), `Expected 'Martes' in: ${label}`);
    assert.ok(label.includes("24"), `Expected '24' in: ${label}`);
    assert.ok(label.includes("14:00"), `Expected '14:00' in: ${label}`);
  });

  it("formats a Saturday slot correctly", () => {
    // 2026-03-21 14:00 ART
    const date = new Date("2026-03-21T17:00:00.000Z");
    const label = formatSlotLabel(date);
    assert.ok(label.includes("Sábado"), `Expected 'Sábado' in: ${label}`);
    assert.ok(label.includes("21"), `Expected '21' in: ${label}`);
  });

  it("formats a Sunday slot correctly", () => {
    // 2026-03-22 09:00 ART
    const date = new Date("2026-03-22T12:00:00.000Z");
    const label = formatSlotLabel(date);
    assert.ok(label.includes("Domingo"), `Expected 'Domingo' in: ${label}`);
    assert.ok(label.includes("22"), `Expected '22' in: ${label}`);
  });

  it("formats end-of-month date correctly (31/03)", () => {
    // 2026-03-31 12:00 ART
    const date = new Date("2026-03-31T15:00:00.000Z");
    const label = formatSlotLabel(date);
    assert.ok(label.includes("31"), `Expected '31' in: ${label}`);
    assert.ok(label.includes("12:00"), `Expected '12:00' in: ${label}`);
  });

  it("formats start-of-month in April correctly", () => {
    // 2026-04-01 09:00 ART
    const date = new Date("2026-04-01T12:00:00.000Z");
    const label = formatSlotLabel(date);
    assert.ok(label.includes("1"), `Expected '1' (day) in: ${label}`);
    assert.ok(label.includes("4"), `Expected '4' (April) in: ${label}`);
  });

  it("formats time with minutes correctly (09:30)", () => {
    // 2026-03-23 09:30 ART
    const date = new Date("2026-03-23T12:30:00.000Z");
    const label = formatSlotLabel(date);
    assert.ok(label.includes("09:30"), `Expected '09:30' in: ${label}`);
  });

  it("includes 'a las' separator", () => {
    const date = new Date("2026-03-25T14:00:00.000Z");
    const label = formatSlotLabel(date);
    assert.ok(label.includes("a las"), `Expected 'a las' in: ${label}`);
  });

  it("includes the correct day name for all weekdays", () => {
    const cases: Array<[string, string]> = [
      ["2026-03-23T13:00:00.000Z", "Lunes"],     // Monday
      ["2026-03-24T13:00:00.000Z", "Martes"],    // Tuesday
      ["2026-03-25T13:00:00.000Z", "Miércoles"], // Wednesday
      ["2026-03-26T13:00:00.000Z", "Jueves"],    // Thursday
      ["2026-03-27T13:00:00.000Z", "Viernes"],   // Friday
      ["2026-03-28T13:00:00.000Z", "Sábado"],    // Saturday
      ["2026-03-22T13:00:00.000Z", "Domingo"],   // Sunday
    ];
    for (const [utc, expectedDay] of cases) {
      const date = new Date(utc);
      const label = formatSlotLabel(date);
      assert.ok(label.includes(expectedDay), `Expected '${expectedDay}' in: ${label} (UTC: ${utc})`);
    }
  });
});
