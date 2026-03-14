import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateAvailableSlots, isSlotAvailable, filterAvailableSlots } from "../index";
import type { WorkingHours, TimeSlot } from "../types";

const MON_WORKING_HOURS: WorkingHours[] = [
  { dayOfWeek: 1, startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
];

// Helper: create a Date on a specific Monday
function monday(h: number, m = 0): Date {
  // 2026-03-16 is a Monday
  const d = new Date("2026-03-16T00:00:00.000Z");
  d.setUTCHours(h, m, 0, 0);
  return d;
}

describe("calculateAvailableSlots", () => {
  it("returns empty array when no working hours for that day", () => {
    // Sunday has no working hours
    const sunday = new Date("2026-03-15T00:00:00.000Z");
    const result = calculateAvailableSlots({
      date: sunday,
      durationMinutes: 60,
      workingHours: MON_WORKING_HOURS,
      existingBookings: [],
    });
    assert.deepEqual(result.availableSlots, []);
  });

  it("returns correct slots with no existing bookings", () => {
    const date = new Date("2026-03-16T00:00:00.000Z");
    // Working 9-12, 60 min slots => 9:00, 10:00, 11:00
    const result = calculateAvailableSlots({
      date,
      durationMinutes: 60,
      workingHours: MON_WORKING_HOURS,
      existingBookings: [],
    });
    assert.equal(result.availableSlots.length, 3);
  });

  it("excludes slots that overlap with existing booking", () => {
    const date = new Date("2026-03-16T00:00:00.000Z");
    const booking: TimeSlot = {
      start: monday(9),
      end: monday(10),
    };
    const result = calculateAvailableSlots({
      date,
      durationMinutes: 60,
      workingHours: MON_WORKING_HOURS,
      existingBookings: [booking],
    });
    // 9:00 is taken, 10:00 and 11:00 are free
    assert.equal(result.availableSlots.length, 2);
  });

  it("respects buffer minutes", () => {
    const date = new Date("2026-03-16T00:00:00.000Z");
    const booking: TimeSlot = {
      start: monday(9),
      end: monday(10),
    };
    // With 30 min buffer after booking (ends 10:00 + 30 = 10:30),
    // the 10:00 slot is now blocked (10:00 < 10:30), 11:00 is free
    const result = calculateAvailableSlots({
      date,
      durationMinutes: 60,
      workingHours: MON_WORKING_HOURS,
      existingBookings: [booking],
      bufferMinutes: 30,
    });
    assert.equal(result.availableSlots.length, 1);
  });
});

describe("isSlotAvailable", () => {
  it("returns true when no bookings", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    assert.equal(isSlotAvailable(slot, []), true);
  });

  it("returns false when slot overlaps booking", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(9, 30), end: monday(10, 30) };
    assert.equal(isSlotAvailable(slot, [booking]), false);
  });
});

describe("filterAvailableSlots", () => {
  it("filters out booked slots", () => {
    const slots: TimeSlot[] = [
      { start: monday(9), end: monday(10) },
      { start: monday(10), end: monday(11) },
      { start: monday(11), end: monday(12) },
    ];
    const bookings: TimeSlot[] = [{ start: monday(10), end: monday(11) }];
    const result = filterAvailableSlots(slots, bookings);
    assert.equal(result.length, 2);
  });
});
