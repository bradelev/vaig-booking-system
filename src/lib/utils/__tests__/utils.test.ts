import { describe, it, expect } from "vitest";
import { cn, formatCurrency, formatDate, formatTime, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from "@/lib/utils";

describe("cn — className merger", () => {
  it("merges simple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  it("resolves tailwind conflicts (last wins)", () => {
    const result = cn("p-4", "p-8");
    expect(result).toBe("p-8");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null", () => {
    expect(cn(undefined, null, "foo")).toBe("foo");
  });
});

describe("formatCurrency", () => {
  it("formats integer amount in ARS", () => {
    const result = formatCurrency(1000);
    expect(result).toContain("1.000");
    expect(result).toContain("$");
  });

  it("formats zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("formats large amounts", () => {
    const result = formatCurrency(50000);
    expect(result).toContain("50.000");
  });
});

describe("formatDate", () => {
  it("formats ISO string to DD/MM/YYYY in ART timezone", () => {
    // 2026-04-20T12:00:00Z = 09:00 ART (UTC-3) = still April 20
    const result = formatDate("2026-04-20T12:00:00.000Z");
    expect(result).toMatch(/20\/04\/2026/);
  });

  it("accepts Date object", () => {
    const result = formatDate(new Date("2026-04-20T12:00:00.000Z"));
    expect(result).toMatch(/20\/04\/2026/);
  });

  it("handles date near midnight ART boundary", () => {
    // 2026-04-20T02:00:00Z = April 19 at 23:00 ART
    const result = formatDate("2026-04-20T02:00:00.000Z");
    expect(result).toMatch(/19\/04\/2026/);
  });
});

describe("formatTime", () => {
  it("formats ISO string to HH:MM in ART timezone", () => {
    // 2026-04-20T15:00:00Z = 12:00 ART
    const result = formatTime("2026-04-20T15:00:00.000Z");
    expect(result).toBe("12:00");
  });

  it("formats time with minutes", () => {
    // 2026-04-20T18:30:00Z = 15:30 ART
    const result = formatTime("2026-04-20T18:30:00.000Z");
    expect(result).toBe("15:30");
  });

  it("uses 24-hour format", () => {
    // 2026-04-20T22:00:00Z = 19:00 ART
    const result = formatTime("2026-04-20T22:00:00.000Z");
    expect(result).toBe("19:00");
  });
});

describe("BOOKING_STATUS_LABELS", () => {
  it("contains all expected statuses", () => {
    const expectedStatuses = ["pending", "deposit_paid", "confirmed", "realized", "cancelled", "no_show"];
    for (const status of expectedStatuses) {
      expect(BOOKING_STATUS_LABELS[status], `Missing label for ${status}`).toBeDefined();
      expect(typeof BOOKING_STATUS_LABELS[status]).toBe("string");
    }
  });

  it("confirmed maps to Confirmada", () => {
    expect(BOOKING_STATUS_LABELS["confirmed"]).toBe("Confirmada");
  });

  it("cancelled maps to Cancelada", () => {
    expect(BOOKING_STATUS_LABELS["cancelled"]).toBe("Cancelada");
  });
});

describe("BOOKING_STATUS_COLORS", () => {
  it("contains tailwind class strings for all statuses", () => {
    const expectedStatuses = ["pending", "deposit_paid", "confirmed", "realized", "cancelled", "no_show"];
    for (const status of expectedStatuses) {
      expect(BOOKING_STATUS_COLORS[status], `Missing color for ${status}`).toBeDefined();
      expect(BOOKING_STATUS_COLORS[status]).toMatch(/bg-/);
    }
  });
});
