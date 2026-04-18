import { describe, it, expect } from "vitest";

import { isSlotAvailable, filterAvailableSlots } from "../index";
import type { TimeSlot } from "../types";

// 2026-03-16 is a Monday
function monday(h: number, m = 0): Date {
  const d = new Date("2026-03-16T12:00:00.000Z");
  d.setHours(h, m, 0, 0);
  return d;
}

describe("isSlotAvailable", () => {
  it("returns true when there are no bookings", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    expect(isSlotAvailable(slot, [])).toBe(true);
  });

  it("returns false when slot exactly matches a booking", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(9), end: monday(10) };
    expect(isSlotAvailable(slot, [booking])).toBe(false);
  });

  it("returns false when slot is completely inside a booking", () => {
    const slot: TimeSlot = { start: monday(9, 30), end: monday(10) };
    const booking: TimeSlot = { start: monday(9), end: monday(10, 30) };
    expect(isSlotAvailable(slot, [booking])).toBe(false);
  });

  it("returns false when booking is completely inside the slot", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(11) };
    const booking: TimeSlot = { start: monday(9, 30), end: monday(10, 30) };
    expect(isSlotAvailable(slot, [booking])).toBe(false);
  });

  it("returns false for partial overlap at end of slot", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(9, 30), end: monday(10, 30) };
    expect(isSlotAvailable(slot, [booking])).toBe(false);
  });

  it("returns false for partial overlap at start of slot", () => {
    const slot: TimeSlot = { start: monday(10), end: monday(11) };
    const booking: TimeSlot = { start: monday(9, 30), end: monday(10, 30) };
    expect(isSlotAvailable(slot, [booking])).toBe(false);
  });

  it("returns true when booking ends exactly when slot starts (adjacent)", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(8), end: monday(9) };
    expect(isSlotAvailable(slot, [booking])).toBe(true);
  });

  it("returns true when slot ends exactly when booking starts (adjacent)", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(10), end: monday(11) };
    expect(isSlotAvailable(slot, [booking])).toBe(true);
  });

  it("returns true when slot is before all bookings", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const bookings: TimeSlot[] = [
      { start: monday(11), end: monday(12) },
      { start: monday(13), end: monday(14) },
    ];
    expect(isSlotAvailable(slot, bookings)).toBe(true);
  });

  it("returns false when slot overlaps any booking in a list", () => {
    const slot: TimeSlot = { start: monday(10), end: monday(11) };
    const bookings: TimeSlot[] = [
      { start: monday(9), end: monday(9, 30) },
      { start: monday(10, 30), end: monday(11, 30) }, // overlaps
    ];
    expect(isSlotAvailable(slot, bookings)).toBe(false);
  });

  // ── Buffer tests ─────────────────────────────────────────────────────────────

  it("returns false with buffer when slot starts within buffer window", () => {
    // Booking 8:00-9:00 + 30 min buffer = 9:30 boundary. Slot 9:00 is blocked.
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(8), end: monday(9) };
    expect(isSlotAvailable(slot, [booking], 30)).toBe(false);
  });

  it("returns true with buffer when slot starts after buffer window", () => {
    // Booking 8:00-9:00 + 30 min buffer = 9:30 boundary. Slot at 9:30 is free.
    const slot: TimeSlot = { start: monday(9, 30), end: monday(10, 30) };
    const booking: TimeSlot = { start: monday(8), end: monday(9) };
    expect(isSlotAvailable(slot, [booking], 30)).toBe(true);
  });

  it("returns false with buffer when slot starts exactly at buffer boundary", () => {
    // Booking 8:00-9:00 + 60 min buffer = 10:00 boundary. Slot at 9:30 is still blocked.
    const slot: TimeSlot = { start: monday(9, 30), end: monday(10, 30) };
    const booking: TimeSlot = { start: monday(8), end: monday(9) };
    expect(isSlotAvailable(slot, [booking], 60)).toBe(false);
  });

  it("returns true with zero buffer (same as no buffer)", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(8), end: monday(9) };
    expect(isSlotAvailable(slot, [booking], 0)).toBe(true);
  });
});

describe("filterAvailableSlots", () => {
  const slots: TimeSlot[] = [
    { start: monday(9), end: monday(10) },
    { start: monday(10), end: monday(11) },
    { start: monday(11), end: monday(12) },
  ];

  it("returns all slots when there are no bookings", () => {
    const result = filterAvailableSlots(slots, []);
    expect(result.length).toBe(3);
  });

  it("returns empty array when all slots are booked", () => {
    const bookings: TimeSlot[] = [...slots];
    const result = filterAvailableSlots(slots, bookings);
    expect(result.length).toBe(0);
  });

  it("filters out only the booked slot", () => {
    const bookings: TimeSlot[] = [{ start: monday(10), end: monday(11) }];
    const result = filterAvailableSlots(slots, bookings);
    expect(result.length).toBe(2);
    expect(result[0].start.getHours()).toBe(9);
    expect(result[1].start.getHours()).toBe(11);
  });

  it("returns correct slots with buffer applied", () => {
    // Booking at 9:00-10:00 with 30 min buffer blocks 10:00 slot too
    const bookings: TimeSlot[] = [{ start: monday(9), end: monday(10) }];
    const result = filterAvailableSlots(slots, bookings, 30);
    expect(result.length).toBe(1);
    expect(result[0].start.getHours()).toBe(11);
  });

  it("returns empty array when input slots list is empty", () => {
    const bookings: TimeSlot[] = [{ start: monday(9), end: monday(10) }];
    const result = filterAvailableSlots([], bookings);
    expect(result.length).toBe(0);
  });

  it("preserves slot order", () => {
    const bookings: TimeSlot[] = [{ start: monday(10), end: monday(11) }];
    const result = filterAvailableSlots(slots, bookings);
    expect(result[0].start.getHours()).toBe(9);
    expect(result[1].start.getHours()).toBe(11);
  });

  it("handles overlapping bookings without duplicating filtered slots", () => {
    // Two bookings that both overlap the 10:00 slot
    const bookings: TimeSlot[] = [
      { start: monday(9, 30), end: monday(10, 30) },
      { start: monday(10), end: monday(11) },
    ];
    const result = filterAvailableSlots(slots, bookings);
    expect(result.length).toBe(1);
    expect(result[0].start.getHours()).toBe(11);
  });
});
