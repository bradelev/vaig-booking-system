/**
 * Scheduler DB helpers — fetches real availability from Supabase.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateAvailableSlots } from "./index";
import type { TimeSlot, WorkingHours } from "./types";
import type { SlotOption } from "@/lib/bot/types";
import { artMidnight, artDateTime, getARTComponents } from "@/lib/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const TZ = "America/Argentina/Buenos_Aires";

/**
 * Formats a Date in Buenos Aires timezone as a human-readable label.
 * e.g. "Lunes 17/03 a las 10:00"
 */
export function formatSlotLabel(date: Date): string {
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const dayOfWeek = dayNames[
    parseInt(date.toLocaleDateString("es-AR", { timeZone: TZ, weekday: "short" }).charAt(0) === "D"
      ? "0" : date.toLocaleString("en-US", { timeZone: TZ, weekday: "long" }) === "Monday" ? "1"
      : date.toLocaleString("en-US", { timeZone: TZ, weekday: "long" }) === "Tuesday" ? "2"
      : date.toLocaleString("en-US", { timeZone: TZ, weekday: "long" }) === "Wednesday" ? "3"
      : date.toLocaleString("en-US", { timeZone: TZ, weekday: "long" }) === "Thursday" ? "4"
      : date.toLocaleString("en-US", { timeZone: TZ, weekday: "long" }) === "Friday" ? "5"
      : date.toLocaleString("en-US", { timeZone: TZ, weekday: "long" }) === "Saturday" ? "6"
      : "0")
  ];
  const dateStr = date.toLocaleDateString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  const timeStr = date.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dayOfWeek} ${dateStr} a las ${timeStr}`;
}

/**
 * Gets working hours for a professional from DB (professional_schedule table).
 * Falls back to default Mon-Fri 9-18 if no schedule configured.
 */
async function getProfessionalWorkingHours(professionalId: string): Promise<WorkingHours[]> {
  const client = createAdminClient() as AnyClient;

  const { data } = await client
    .from("professional_schedule")
    .select("day_of_week, start_time, end_time, is_working")
    .eq("professional_id", professionalId)
    .eq("is_working", true);

  if (!data || data.length === 0) {
    // Default: Mon-Sat 9:00-18:00
    return [1, 2, 3, 4, 5, 6].map((day) => ({
      dayOfWeek: day,
      startHour: 9,
      startMinute: 0,
      endHour: 18,
      endMinute: 0,
    }));
  }

  return (data as Array<{ day_of_week: number; start_time: string; end_time: string }>).map((row) => {
    const [startH, startM] = row.start_time.split(":").map(Number);
    const [endH, endM] = row.end_time.split(":").map(Number);
    return {
      dayOfWeek: row.day_of_week,
      startHour: startH,
      startMinute: startM,
      endHour: endH,
      endMinute: endM,
    };
  });
}

/**
 * Gets existing bookings for a professional on a specific date.
 */
async function getExistingBookings(
  professionalId: string,
  date: Date
): Promise<TimeSlot[]> {
  const client = createAdminClient() as AnyClient;

  // Day range in UTC based on TZ date
  const dateStr = date.toLocaleDateString("sv-SE", { timeZone: TZ });
  const dayStart = new Date(`${dateStr}T00:00:00-03:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59-03:00`);

  const { data } = await client
    .from("bookings")
    .select("scheduled_at, services(duration_minutes)")
    .eq("professional_id", professionalId)
    .gte("scheduled_at", dayStart.toISOString())
    .lte("scheduled_at", dayEnd.toISOString())
    .not("status", "in", '("cancelled","no_show")');

  if (!data) return [];

  return (data as Array<{ scheduled_at: string; services: { duration_minutes: number } | null }>).map(
    (b) => {
      const start = new Date(b.scheduled_at);
      const durationMs = (b.services?.duration_minutes ?? 60) * 60_000;
      return { start, end: new Date(start.getTime() + durationMs) };
    }
  );
}

// ── Time window types ─────────────────────────────────────────────────────────

export interface TimeWindow {
  label: string;     // e.g. "Mañana"
  emoji: string;     // e.g. "☀️"
  startHour: number; // e.g. 9
  endHour: number;   // e.g. 12
}

export interface SlotsByDay {
  dateLabel: string;  // e.g. "Lunes 23/03"
  date: string;       // ISO date string "2026-03-23"
  windows: Array<{
    window: TimeWindow;
    slots: SlotOption[];
  }>;
}

/**
 * Returns available slots grouped by day and time window.
 * Looks up to 7 days ahead.
 */
export async function getSlotsByWindow(
  professionalId: string,
  durationMinutes: number,
  bufferMinutes: number,
  windows: TimeWindow[],
  maxDays = 7
): Promise<SlotsByDay[]> {
  const workingHours = await getProfessionalWorkingHours(professionalId);
  const result: SlotsByDay[] = [];

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + 1);

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const rawDate = new Date(startDate);
    rawDate.setDate(startDate.getDate() + dayOffset);
    const checkDate = artMidnight(rawDate);

    const existingBookings = await getExistingBookings(professionalId, checkDate);
    const { availableSlots } = calculateAvailableSlots({
      date: checkDate,
      durationMinutes,
      workingHours,
      existingBookings,
      bufferMinutes,
    });

    if (availableSlots.length === 0) continue;

    const dayWindows: SlotsByDay["windows"] = [];
    for (const window of windows) {
      const windowSlots = availableSlots
        .filter((s) => {
          const { hour } = getARTComponents(s.start);
          return hour >= window.startHour && hour < window.endHour;
        })
        .map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          label: formatSlotLabel(s.start),
        }));

      if (windowSlots.length > 0) {
        dayWindows.push({ window, slots: windowSlots });
      }
    }

    if (dayWindows.length > 0) {
      const dateStr = checkDate.toLocaleDateString("sv-SE", { timeZone: TZ });
      result.push({
        dateLabel: formatSlotLabel(checkDate).split(" a las")[0], // "Lunes 23/03"
        date: dateStr,
        windows: dayWindows,
      });
    }
  }

  return result;
}

/**
 * Returns up to 3 available slot options for a service+professional combination
 * starting from today+1 day, looking up to 7 days ahead.
 */
export async function getNextAvailableSlots(
  professionalId: string,
  durationMinutes: number,
  bufferMinutes = 0,
  maxSlots = 3
): Promise<SlotOption[]> {
  const workingHours = await getProfessionalWorkingHours(professionalId);
  const slots: SlotOption[] = [];

  const now = new Date();
  // Start from next day (don't book same day)
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + 1);

  for (let dayOffset = 0; dayOffset < 14 && slots.length < maxSlots; dayOffset++) {
    const rawDate = new Date(startDate);
    rawDate.setDate(startDate.getDate() + dayOffset);
    const checkDate = artMidnight(rawDate);

    const existingBookings = await getExistingBookings(professionalId, checkDate);

    const result = calculateAvailableSlots({
      date: checkDate,
      durationMinutes,
      workingHours,
      existingBookings,
      bufferMinutes,
    });

    for (const slot of result.availableSlots) {
      if (slots.length >= maxSlots) break;
      slots.push({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        label: formatSlotLabel(slot.start),
      });
    }
  }

  return slots;
}

/**
 * Checks if a specific datetime is available for a professional.
 */
export async function checkSlotAvailability(
  professionalId: string,
  start: Date,
  durationMinutes: number,
  bufferMinutes = 0
): Promise<{ available: boolean; alternatives: SlotOption[] }> {
  const workingHours = await getProfessionalWorkingHours(professionalId);
  const existingBookings = await getExistingBookings(professionalId, start);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const { dayOfWeek: artDayOfWeek } = getARTComponents(start);
  const slotFits = workingHours.some((wh) => {
    if (wh.dayOfWeek !== artDayOfWeek) return false;
    const whStart = artDateTime(start, wh.startHour, wh.startMinute);
    const whEnd = artDateTime(start, wh.endHour, wh.endMinute);
    return start >= whStart && end <= whEnd;
  });

  if (!slotFits) {
    const alternatives = await getNextAvailableSlots(professionalId, durationMinutes, bufferMinutes);
    return { available: false, alternatives };
  }

  const hasConflict = existingBookings.some((b) => {
    const bufferEnd = new Date(b.end.getTime() + bufferMinutes * 60_000);
    return start < bufferEnd && end > b.start;
  });

  if (hasConflict) {
    const alternatives = await getNextAvailableSlots(professionalId, durationMinutes, bufferMinutes);
    return { available: false, alternatives };
  }

  return { available: true, alternatives: [] };
}
