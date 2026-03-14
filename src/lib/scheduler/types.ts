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
