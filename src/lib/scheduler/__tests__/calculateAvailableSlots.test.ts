import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateAvailableSlots, isSlotAvailable, filterAvailableSlots } from "../index";
import type { WorkingHours, TimeSlot } from "../types";

const MON_WORKING_HOURS: WorkingHours[] = [
  { dayOfWeek: 1, startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
];

// Helper: create a Date on a specific Monday using local time
function monday(h: number, m = 0): Date {
  // 2026-03-16 is a Monday — use noon UTC to stay on Monday in any timezone
  const d = new Date("2026-03-16T12:00:00.000Z");
  d.setHours(h, m, 0, 0);
  return d;
}

describe("calculateAvailableSlots", () => {
  it("returns empty array when no working hours for that day", () => {
    // Sunday has no working hours
    const sunday = new Date("2026-03-15T12:00:00.000Z");
    const result = calculateAvailableSlots({
      date: sunday,
      durationMinutes: 60,
      workingHours: MON_WORKING_HOURS,
      existingBookings: [],
    });
    assert.deepEqual(result.availableSlots, []);
  });

  it("returns correct slots with no existing bookings", () => {
    const date = new Date("2026-03-16T12:00:00.000Z");
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
    const date = new Date("2026-03-16T12:00:00.000Z");
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
    const date = new Date("2026-03-16T12:00:00.000Z");
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

// ── Edge cases ─────────────────────────────────────────────────────────────────

describe("calculateAvailableSlots — edge cases", () => {
  it("handles multiple periods in the same day", () => {
    const TWO_PERIOD_HOURS: WorkingHours[] = [
      { dayOfWeek: 1, startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
      { dayOfWeek: 1, startHour: 14, startMinute: 0, endHour: 17, endMinute: 0 },
    ];
    const date = new Date("2026-03-16T12:00:00.000Z");
    const result = calculateAvailableSlots({
      date,
      durationMinutes: 60,
      workingHours: TWO_PERIOD_HOURS,
      existingBookings: [],
    });
    // Morning: 9:00, 10:00, 11:00 (3 slots); Afternoon: 14:00, 15:00, 16:00 (3 slots)
    assert.equal(result.availableSlots.length, 6);
  });

  it("returns no slots when all are booked in a period", () => {
    const date = new Date("2026-03-16T12:00:00.000Z");
    const bookings: TimeSlot[] = [
      { start: monday(9), end: monday(10) },
      { start: monday(10), end: monday(11) },
      { start: monday(11), end: monday(12) },
    ];
    const result = calculateAvailableSlots({
      date,
      durationMinutes: 60,
      workingHours: MON_WORKING_HOURS,
      existingBookings: bookings,
    });
    assert.equal(result.availableSlots.length, 0);
  });

  it("returns slots for 30-minute duration", () => {
    const date = new Date("2026-03-16T12:00:00.000Z");
    // Working 9-12 (180 min), 30 min slots => 6 slots
    const result = calculateAvailableSlots({
      date,
      durationMinutes: 30,
      workingHours: MON_WORKING_HOURS,
      existingBookings: [],
    });
    assert.equal(result.availableSlots.length, 6);
  });

  it("does not include a slot that starts exactly at period end", () => {
    // Working 9-10 with 60-min slot: only 9:00 fits. 10:00 would require end at 11:00, outside range.
    const NARROW_HOURS: WorkingHours[] = [
      { dayOfWeek: 1, startHour: 9, startMinute: 0, endHour: 10, endMinute: 0 },
    ];
    const date = new Date("2026-03-16T12:00:00.000Z");
    const result = calculateAvailableSlots({
      date,
      durationMinutes: 60,
      workingHours: NARROW_HOURS,
      existingBookings: [],
    });
    assert.equal(result.availableSlots.length, 1);
  });

  it("buffer blocks slot immediately after booking but leaves later slots free", () => {
    const date = new Date("2026-03-16T12:00:00.000Z");
    // Booking at 9-10. With 60-min buffer, buffer extends to 11:00.
    // Slots: 9:00 blocked (overlaps booking), 10:00 blocked (within buffer), 11:00 free.
    const booking: TimeSlot = { start: monday(9), end: monday(10) };
    const result = calculateAvailableSlots({
      date,
      durationMinutes: 60,
      workingHours: MON_WORKING_HOURS,
      existingBookings: [booking],
      bufferMinutes: 60,
    });
    assert.equal(result.availableSlots.length, 1);
    assert.equal(result.availableSlots[0].start.getHours(), 11);
  });
});

describe("isSlotAvailable — edge cases", () => {
  it("returns true when booking ends exactly when slot starts (adjacent, no overlap)", () => {
    // Booking 8:00-9:00, slot 9:00-10:00 → should be available
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(8), end: monday(9) };
    assert.equal(isSlotAvailable(slot, [booking]), true);
  });

  it("returns false when slot starts exactly when booking starts", () => {
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(9), end: monday(10) };
    assert.equal(isSlotAvailable(slot, [booking]), false);
  });

  it("returns false for partial overlap at end of slot", () => {
    // Slot 9:00-10:00, Booking 9:30-10:30
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(9, 30), end: monday(10, 30) };
    assert.equal(isSlotAvailable(slot, [booking]), false);
  });

  it("returns false for partial overlap at start of slot", () => {
    // Slot 10:00-11:00, Booking 9:30-10:30
    const slot: TimeSlot = { start: monday(10), end: monday(11) };
    const booking: TimeSlot = { start: monday(9, 30), end: monday(10, 30) };
    assert.equal(isSlotAvailable(slot, [booking]), false);
  });

  it("returns true with buffer when adjacent booking respects gap", () => {
    // Booking 8:00-9:00 + 30min buffer = 9:30 boundary. Slot starts at 9:30.
    const slot: TimeSlot = { start: monday(9, 30), end: monday(10, 30) };
    const booking: TimeSlot = { start: monday(8), end: monday(9) };
    assert.equal(isSlotAvailable(slot, [booking], 30), true);
  });

  it("returns false with buffer when slot starts within buffer window", () => {
    // Booking 8:00-9:00 + 30min buffer = 9:30 boundary. Slot starting at 9:00 should be blocked.
    const slot: TimeSlot = { start: monday(9), end: monday(10) };
    const booking: TimeSlot = { start: monday(8), end: monday(9) };
    assert.equal(isSlotAvailable(slot, [booking], 30), false);
  });
});
