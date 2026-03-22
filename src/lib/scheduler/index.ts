import type { SchedulerInput, SchedulerResult, TimeSlot, WorkingHours } from "./types";
import { getARTComponents, artDateTime } from "@/lib/timezone";

export type { SchedulerInput, SchedulerResult, TimeSlot, WorkingHours };

/**
 * Returns available time slots for a given date, duration, working hours and existing bookings.
 * All logic is pure (no I/O). Dates must represent ART (UTC-3) midnight for the target day.
 */
export function calculateAvailableSlots(input: SchedulerInput): SchedulerResult {
  const { date, durationMinutes, workingHours, existingBookings, bufferMinutes = 0 } = input;

  const { dayOfWeek } = getARTComponents(date);
  const dayHours = workingHours.filter((wh) => wh.dayOfWeek === dayOfWeek);

  if (dayHours.length === 0) {
    return { availableSlots: [] };
  }

  const slots: TimeSlot[] = [];

  for (const wh of dayHours) {
    const periodStart = artDateTime(date, wh.startHour, wh.startMinute);
    const periodEnd = artDateTime(date, wh.endHour, wh.endMinute);

    let cursor = new Date(periodStart);

    while (cursor.getTime() + durationMinutes * 60_000 <= periodEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);

      const overlaps = existingBookings.some((booking) => {
        const bufferEnd = new Date(booking.end.getTime() + bufferMinutes * 60_000);
        return cursor < bufferEnd && slotEnd > booking.start;
      });

      if (!overlaps) {
        slots.push({ start: new Date(cursor), end: slotEnd });
      }

      cursor = new Date(cursor.getTime() + durationMinutes * 60_000);
    }
  }

  return { availableSlots: slots };
}

/**
 * Checks if a specific slot is available given existing bookings.
 */
export function isSlotAvailable(
  slot: TimeSlot,
  existingBookings: TimeSlot[],
  bufferMinutes = 0
): boolean {
  return !existingBookings.some((booking) => {
    const bufferEnd = new Date(booking.end.getTime() + bufferMinutes * 60_000);
    return slot.start < bufferEnd && slot.end > booking.start;
  });
}

/**
 * Filters a list of slots to only those still available.
 */
export function filterAvailableSlots(
  slots: TimeSlot[],
  existingBookings: TimeSlot[],
  bufferMinutes = 0
): TimeSlot[] {
  return slots.filter((slot) => isSlotAvailable(slot, existingBookings, bufferMinutes));
}
