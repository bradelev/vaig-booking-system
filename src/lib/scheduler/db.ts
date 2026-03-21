/**
 * Scheduler DB helpers — fetches real availability from Supabase.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateAvailableSlots } from "./index";
import type { TimeSlot, WorkingHours } from "./types";
import type { SlotOption } from "@/lib/bot/types";

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
    const checkDate = new Date(startDate);
    checkDate.setDate(startDate.getDate() + dayOffset);
    checkDate.setHours(0, 0, 0, 0);

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

  const slotFits = workingHours.some((wh) => {
    if (wh.dayOfWeek !== start.getDay()) return false;
    const whStart = new Date(start);
    whStart.setHours(wh.startHour, wh.startMinute, 0, 0);
    const whEnd = new Date(start);
    whEnd.setHours(wh.endHour, wh.endMinute, 0, 0);
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
