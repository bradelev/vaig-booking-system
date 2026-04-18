import { describe, it, expect } from "vitest";

import { resolveWorkingHoursForDate } from "../types";
import { calculateAvailableSlots } from "../index";
import { artDateTime } from "../../timezone";
import type { WorkingHours, ScheduleOverride } from "../types";

// Standard weekly schedule: Mon-Sat 9-18
const WEEKLY: WorkingHours[] = [1, 2, 3, 4, 5, 6].map((day) => ({
  dayOfWeek: day,
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
}));

describe("resolveWorkingHoursForDate", () => {
  it("returns weekly schedule when no override", () => {
    const result = resolveWorkingHoursForDate(WEEKLY, null, 1); // Monday
    expect(result.length).toBe(1);
    expect(result[0].dayOfWeek).toBe(1);
    expect(result[0].startHour).toBe(9);
    expect(result[0].endHour).toBe(18);
  });

  it("returns weekly schedule when override is undefined", () => {
    const result = resolveWorkingHoursForDate(WEEKLY, undefined, 2);
    expect(result.length).toBe(1);
    expect(result[0].dayOfWeek).toBe(2);
  });

  it("returns empty for non-working day without override", () => {
    const result = resolveWorkingHoursForDate(WEEKLY, null, 0); // Sunday
    expect(result.length).toBe(0);
  });

  it("override replaces regular schedule with reduced hours", () => {
    const override: ScheduleOverride = {
      override_date: "2026-03-23",
      start_time: "10:00",
      end_time: "14:00",
      is_working: true,
    };
    const result = resolveWorkingHoursForDate(WEEKLY, override, 1); // Monday
    expect(result.length).toBe(1);
    expect(result[0].startHour).toBe(10);
    expect(result[0].startMinute).toBe(0);
    expect(result[0].endHour).toBe(14);
    expect(result[0].endMinute).toBe(0);
    expect(result[0].dayOfWeek).toBe(1);
  });

  it("day-off override returns empty hours", () => {
    const override: ScheduleOverride = {
      override_date: "2026-03-23",
      start_time: null,
      end_time: null,
      is_working: false,
    };
    const result = resolveWorkingHoursForDate(WEEKLY, override, 1); // Monday
    expect(result.length).toBe(0);
  });

  it("extra working day override on Sunday", () => {
    const override: ScheduleOverride = {
      override_date: "2026-03-22",
      start_time: "09:00",
      end_time: "13:00",
      is_working: true,
    };
    const result = resolveWorkingHoursForDate(WEEKLY, override, 0); // Sunday
    expect(result.length).toBe(1);
    expect(result[0].dayOfWeek).toBe(0);
    expect(result[0].startHour).toBe(9);
    expect(result[0].endHour).toBe(13);
  });

  it("override with minutes in times", () => {
    const override: ScheduleOverride = {
      override_date: "2026-03-23",
      start_time: "10:30",
      end_time: "14:45",
      is_working: true,
    };
    const result = resolveWorkingHoursForDate(WEEKLY, override, 1);
    expect(result[0].startHour).toBe(10);
    expect(result[0].startMinute).toBe(30);
    expect(result[0].endHour).toBe(14);
    expect(result[0].endMinute).toBe(45);
  });
});

describe("override integration with calculateAvailableSlots", () => {
  // 2026-03-23 is a Monday
  const MON_DATE = new Date("2026-03-23T12:00:00.000Z");

  it("override reduces available slots", () => {
    const override: ScheduleOverride = {
      override_date: "2026-03-23",
      start_time: "10:00",
      end_time: "12:00",
      is_working: true,
    };
    const workingHours = resolveWorkingHoursForDate(WEEKLY, override, 1);
    const result = calculateAvailableSlots({
      date: MON_DATE,
      durationMinutes: 60,
      workingHours,
      existingBookings: [],
    });
    // 10:00-12:00 with 60min slots => 10:00, 11:00
    expect(result.availableSlots.length).toBe(2);
  });

  it("day-off override produces zero slots", () => {
    const override: ScheduleOverride = {
      override_date: "2026-03-23",
      start_time: null,
      end_time: null,
      is_working: false,
    };
    const workingHours = resolveWorkingHoursForDate(WEEKLY, override, 1);
    const result = calculateAvailableSlots({
      date: MON_DATE,
      durationMinutes: 60,
      workingHours,
      existingBookings: [],
    });
    expect(result.availableSlots.length).toBe(0);
  });

  it("Sunday override enables booking on normally off day", () => {
    const SUN_DATE = new Date("2026-03-22T12:00:00.000Z");
    const override: ScheduleOverride = {
      override_date: "2026-03-22",
      start_time: "09:00",
      end_time: "12:00",
      is_working: true,
    };
    const workingHours = resolveWorkingHoursForDate(WEEKLY, override, 0);
    const result = calculateAvailableSlots({
      date: SUN_DATE,
      durationMinutes: 60,
      workingHours,
      existingBookings: [],
    });
    // 9:00-12:00 with 60min slots => 9:00, 10:00, 11:00
    expect(result.availableSlots.length).toBe(3);
  });

  it("override with existing booking removes conflicting slot", () => {
    const override: ScheduleOverride = {
      override_date: "2026-03-23",
      start_time: "10:00",
      end_time: "13:00",
      is_working: true,
    };
    const workingHours = resolveWorkingHoursForDate(WEEKLY, override, 1);
    const booking = {
      start: artDateTime(MON_DATE, 11, 0),
      end: artDateTime(MON_DATE, 12, 0),
    };
    const result = calculateAvailableSlots({
      date: MON_DATE,
      durationMinutes: 60,
      workingHours,
      existingBookings: [booking],
    });
    // 10:00-13:00, 60min slots => 10:00, 11:00, 12:00; minus 11:00 booking => 10:00, 12:00
    expect(result.availableSlots.length).toBe(2);
  });
});
