export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface WorkingHours {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startHour: number; // e.g. 9
  startMinute: number; // e.g. 0
  endHour: number; // e.g. 18
  endMinute: number; // e.g. 0
}

export interface SchedulerInput {
  date: Date;
  durationMinutes: number;
  workingHours: WorkingHours[];
  existingBookings: TimeSlot[]; // already-booked slots for that professional/date
  bufferMinutes?: number; // gap between appointments, default 0
}

export interface SchedulerResult {
  availableSlots: TimeSlot[];
}

export interface ScheduleOverride {
  override_date: string;
  start_time: string | null;
  end_time: string | null;
  is_working: boolean;
}

/**
 * Resolves working hours for a specific date, applying an override if present.
 * Pure function — no DB calls.
 */
export function resolveWorkingHoursForDate(
  weeklySchedule: WorkingHours[],
  override: ScheduleOverride | null | undefined,
  dayOfWeek: number
): WorkingHours[] {
  if (override) {
    if (!override.is_working) return [];
    if (override.start_time && override.end_time) {
      const [startH, startM] = override.start_time.split(":").map(Number);
      const [endH, endM] = override.end_time.split(":").map(Number);
      return [{ dayOfWeek, startHour: startH, startMinute: startM, endHour: endH, endMinute: endM }];
    }
  }
  return weeklySchedule.filter((wh) => wh.dayOfWeek === dayOfWeek);
}
