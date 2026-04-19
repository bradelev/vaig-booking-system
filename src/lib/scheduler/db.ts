/**
 * Scheduler DB helpers — fetches real availability from Supabase.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateAvailableSlots } from "./index";
import type { TimeSlot, WorkingHours, ScheduleOverride } from "./types";
import { resolveWorkingHoursForDate } from "./types";
import type { SlotOption, MultiProfSlot } from "@/lib/bot/types";
import { artMidnight, artDateTime, getARTComponents, LOCAL_TIMEZONE, localInputToISO } from "@/lib/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const TZ = LOCAL_TIMEZONE;

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
  const dayStart = new Date(localInputToISO(`${dateStr}T00:00`));
  const dayEnd = new Date(localInputToISO(`${dateStr}T23:59`));

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
 * Fetches schedule overrides for a professional within a date range.
 * Returns a Map keyed by "YYYY-MM-DD" for O(1) lookup per day.
 */
async function getOverridesForRange(
  professionalId: string,
  startDate: Date,
  endDate: Date
): Promise<Map<string, ScheduleOverride>> {
  const client = createAdminClient() as AnyClient;
  const startStr = startDate.toLocaleDateString("sv-SE", { timeZone: TZ });
  const endStr = endDate.toLocaleDateString("sv-SE", { timeZone: TZ });

  const { data } = await client
    .from("professional_schedule_overrides")
    .select("override_date, start_time, end_time, is_working")
    .eq("professional_id", professionalId)
    .gte("override_date", startStr)
    .lte("override_date", endStr);

  const map = new Map<string, ScheduleOverride>();
  if (data) {
    for (const row of data as ScheduleOverride[]) {
      map.set(row.override_date, row);
    }
  }
  return map;
}

/**
 * Fetches a single schedule override for a professional on a specific date.
 */
async function getOverrideForDate(
  professionalId: string,
  date: Date
): Promise<ScheduleOverride | null> {
  const client = createAdminClient() as AnyClient;
  const dateStr = date.toLocaleDateString("sv-SE", { timeZone: TZ });

  const { data } = await client
    .from("professional_schedule_overrides")
    .select("override_date, start_time, end_time, is_working")
    .eq("professional_id", professionalId)
    .eq("override_date", dateStr)
    .maybeSingle();

  return (data as ScheduleOverride | null) ?? null;
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
  const weeklySchedule = await getProfessionalWorkingHours(professionalId);
  const result: SlotsByDay[] = [];

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + 1);

  const rangeEnd = new Date(startDate);
  rangeEnd.setDate(startDate.getDate() + maxDays);
  const overrides = await getOverridesForRange(professionalId, startDate, rangeEnd);

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const rawDate = new Date(startDate);
    rawDate.setDate(startDate.getDate() + dayOffset);
    const checkDate = artMidnight(rawDate);
    const dateKey = checkDate.toLocaleDateString("sv-SE", { timeZone: TZ });
    const { dayOfWeek } = getARTComponents(checkDate);
    const workingHours = resolveWorkingHoursForDate(weeklySchedule, overrides.get(dateKey), dayOfWeek);

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
 * Returns slots for next maxDays days, merging availability across ALL given professionals.
 * Each slot is annotated with which professional IDs are available at that time.
 */
export async function getSlotsByWindowAllProfessionals(
  professionalIds: string[],
  durationMinutes: number,
  bufferMinutes: number,
  windows: TimeWindow[],
  maxDays = 7
): Promise<SlotsByDay[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + 1);
  const rangeEnd = new Date(startDate);
  rangeEnd.setDate(startDate.getDate() + maxDays);

  // Fetch weekly schedules and overrides for all professionals in parallel
  const [schedules, overrideMaps] = await Promise.all([
    Promise.all(professionalIds.map((id) => getProfessionalWorkingHours(id))),
    Promise.all(professionalIds.map((id) => getOverridesForRange(id, startDate, rangeEnd))),
  ]);

  const result: SlotsByDay[] = [];

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const rawDate = new Date(startDate);
    rawDate.setDate(startDate.getDate() + dayOffset);
    const checkDate = artMidnight(rawDate);
    const dateKey = checkDate.toLocaleDateString("sv-SE", { timeZone: TZ });
    const { dayOfWeek } = getARTComponents(checkDate);

    // For each professional, compute their available slots for this day
    const slotsByProfessional: { profId: string; slots: import("./types").TimeSlot[] }[] = [];

    await Promise.all(
      professionalIds.map(async (profId, idx) => {
        const workingHours = resolveWorkingHoursForDate(schedules[idx], overrideMaps[idx].get(dateKey), dayOfWeek);
        const existingBookings = await getExistingBookings(profId, checkDate);
        const { availableSlots } = calculateAvailableSlots({
          date: checkDate,
          durationMinutes,
          workingHours,
          existingBookings,
          bufferMinutes,
        });
        if (availableSlots.length > 0) {
          slotsByProfessional.push({ profId, slots: availableSlots });
        }
      })
    );

    if (slotsByProfessional.length === 0) continue;

    // Merge: group by start time ISO string, union professional IDs
    const mergedMap = new Map<string, { slot: import("./types").TimeSlot; profIds: string[] }>();
    for (const { profId, slots } of slotsByProfessional) {
      for (const slot of slots) {
        const key = slot.start.toISOString();
        if (mergedMap.has(key)) {
          mergedMap.get(key)!.profIds.push(profId);
        } else {
          mergedMap.set(key, { slot, profIds: [profId] });
        }
      }
    }

    // Sort by start time and group into windows
    const allMergedSlots = [...mergedMap.values()].sort(
      (a, b) => a.slot.start.getTime() - b.slot.start.getTime()
    );

    const dayWindows: SlotsByDay["windows"] = [];
    for (const window of windows) {
      const windowSlots: MultiProfSlot[] = allMergedSlots
        .filter(({ slot }) => {
          const { hour } = getARTComponents(slot.start);
          return hour >= window.startHour && hour < window.endHour;
        })
        .map(({ slot, profIds }) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          label: formatSlotLabel(slot.start),
          availableProfessionalIds: profIds,
        }));

      if (windowSlots.length > 0) {
        dayWindows.push({ window, slots: windowSlots });
      }
    }

    if (dayWindows.length > 0) {
      result.push({
        dateLabel: formatSlotLabel(checkDate).split(" a las")[0],
        date: checkDate.toLocaleDateString("sv-SE", { timeZone: TZ }),
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
  const weeklySchedule = await getProfessionalWorkingHours(professionalId);
  const slots: SlotOption[] = [];

  const now = new Date();
  // Start from next day (don't book same day)
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + 1);

  const rangeEnd = new Date(startDate);
  rangeEnd.setDate(startDate.getDate() + 14);
  const overrides = await getOverridesForRange(professionalId, startDate, rangeEnd);

  for (let dayOffset = 0; dayOffset < 14 && slots.length < maxSlots; dayOffset++) {
    const rawDate = new Date(startDate);
    rawDate.setDate(startDate.getDate() + dayOffset);
    const checkDate = artMidnight(rawDate);
    const dateKey = checkDate.toLocaleDateString("sv-SE", { timeZone: TZ });
    const { dayOfWeek } = getARTComponents(checkDate);
    const workingHours = resolveWorkingHoursForDate(weeklySchedule, overrides.get(dateKey), dayOfWeek);

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
 * Returns slots within ±rangeHours of the target time on the same day,
 * then on the next N days at the same hour if not enough found.
 */
export async function getNearbySlots(
  professionalId: string,
  targetDate: Date,
  durationMinutes: number,
  bufferMinutes: number,
  rangeHours = 2,
  maxResults = 5
): Promise<SlotOption[]> {
  const weeklySchedule = await getProfessionalWorkingHours(professionalId);
  const { hour: targetHour } = getARTComponents(targetDate);
  const nearby: SlotOption[] = [];

  // Batch-fetch overrides for today + 3 days ahead
  const rangeEnd = new Date(targetDate);
  rangeEnd.setDate(targetDate.getDate() + 4);
  const overrides = await getOverridesForRange(professionalId, targetDate, rangeEnd);

  // Phase 1: same day, ±rangeHours
  const targetMidnight = artMidnight(targetDate);
  const dateKey0 = targetMidnight.toLocaleDateString("sv-SE", { timeZone: TZ });
  const { dayOfWeek: dow0 } = getARTComponents(targetMidnight);
  const workingHours = resolveWorkingHoursForDate(weeklySchedule, overrides.get(dateKey0), dow0);

  const existingBookings = await getExistingBookings(professionalId, targetDate);
  const { availableSlots } = calculateAvailableSlots({
    date: targetMidnight,
    durationMinutes,
    workingHours,
    existingBookings,
    bufferMinutes,
  });

  for (const slot of availableSlots) {
    const { hour } = getARTComponents(slot.start);
    if (Math.abs(hour - targetHour) <= rangeHours && nearby.length < maxResults) {
      nearby.push({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        label: formatSlotLabel(slot.start),
      });
    }
  }

  // Phase 2: ±rangeHours on next 3 days if still need more
  if (nearby.length < maxResults) {
    for (let daysAhead = 1; daysAhead <= 3 && nearby.length < maxResults; daysAhead++) {
      const rawDate = new Date(targetDate);
      rawDate.setDate(rawDate.getDate() + daysAhead);
      const checkDate = artMidnight(rawDate);
      const dateKey = checkDate.toLocaleDateString("sv-SE", { timeZone: TZ });
      const { dayOfWeek } = getARTComponents(checkDate);
      const dayWorkingHours = resolveWorkingHoursForDate(weeklySchedule, overrides.get(dateKey), dayOfWeek);

      const dayBookings = await getExistingBookings(professionalId, checkDate);
      const { availableSlots: daySlots } = calculateAvailableSlots({
        date: checkDate,
        durationMinutes,
        workingHours: dayWorkingHours,
        existingBookings: dayBookings,
        bufferMinutes,
      });

      for (const slot of daySlots) {
        const { hour } = getARTComponents(slot.start);
        if (Math.abs(hour - targetHour) <= rangeHours && nearby.length < maxResults) {
          nearby.push({
            start: slot.start.toISOString(),
            end: slot.end.toISOString(),
            label: formatSlotLabel(slot.start),
          });
        }
      }
    }
  }

  return nearby;
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
  const weeklySchedule = await getProfessionalWorkingHours(professionalId);
  const override = await getOverrideForDate(professionalId, start);
  const existingBookings = await getExistingBookings(professionalId, start);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const { dayOfWeek: artDayOfWeek } = getARTComponents(start);
  const workingHours = resolveWorkingHoursForDate(weeklySchedule, override, artDayOfWeek);
  const slotFits = workingHours.some((wh) => {
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
