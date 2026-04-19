/**
 * Timezone helpers for the local business timezone (default: America/Montevideo / UYT, UTC-3).
 *
 * LOCAL_TIMEZONE is the sync fallback. Use getLocalTimezone() in server actions/server
 * components to get the value stored in system_config (key: local_timezone).
 */

import { getConfigValue } from "@/lib/config";

export const LOCAL_TIMEZONE = "America/Montevideo";

/** Returns the configured local timezone from system_config (cached). Falls back to LOCAL_TIMEZONE. */
export async function getLocalTimezone(): Promise<string> {
  try {
    return await getConfigValue("local_timezone", LOCAL_TIMEZONE);
  } catch {
    return LOCAL_TIMEZONE;
  }
}

/**
 * Returns the UTC offset in minutes for `tz` at the given `date` (or now).
 * Works correctly for zones with DST.
 * Example: UTC-3 → -180
 */
function getOffsetMinutes(tz: string, date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  // Format: "GMT-3", "GMT+5:30", "GMT+0"
  const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3] ?? "0", 10);
  return sign * (hours * 60 + minutes);
}

/**
 * Returns a formatted UTC offset string like "-03:00" or "+05:30"
 * for the given timezone at the given moment.
 */
function formatOffset(tz: string, date: Date = new Date()): string {
  const totalMinutes = getOffsetMinutes(tz, date);
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/** Returns a Date representing midnight local time for the given date string (YYYY-MM-DD) */
export function artMidnight(date: Date, tz: string = LOCAL_TIMEZONE): Date {
  const dateStr = date.toLocaleDateString("sv-SE", { timeZone: tz });
  const offset = formatOffset(tz, new Date(`${dateStr}T00:00:00Z`));
  return new Date(`${dateStr}T00:00:00${offset}`);
}

/** Returns local time components (year, month, day, hour, minute, dayOfWeek) for a Date */
export function getARTComponents(
  date: Date,
  tz: string = LOCAL_TIMEZONE
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
} {
  const dayNames: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const str = date.toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
  });
  const weekdayMatch = str.match(/^(\w+)/);
  const dayOfWeek = weekdayMatch ? (dayNames[weekdayMatch[1]] ?? 0) : 0;

  const dateParts = date
    .toLocaleDateString("sv-SE", { timeZone: tz })
    .split("-")
    .map(Number);
  const [year, month, day] = dateParts;

  const timeParts = date
    .toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .split(":")
    .map(Number);
  // Node.js on Linux returns 24 for midnight in "2-digit" + hour12:false; normalize to 0.
  const [rawHour, minute] = timeParts;
  const hour = rawHour === 24 ? 0 : rawHour;

  return { year, month, day, hour, minute, dayOfWeek };
}

/** Creates a Date for a specific date + time in the local timezone */
export function artDateTime(dateInLocal: Date, hour: number, minute: number, tz: string = LOCAL_TIMEZONE): Date {
  const dateStr = dateInLocal.toLocaleDateString("sv-SE", { timeZone: tz });
  const pivot = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const offset = formatOffset(tz, pivot);
  return new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`);
}

/**
 * Converts a datetime-local input string ("YYYY-MM-DDTHH:mm") — interpreted as local time —
 * to an ISO UTC string safe to store in a Postgres timestamptz column.
 *
 * Without this, Postgres interprets the offset-less literal as UTC and shifts
 * every time by the local UTC offset when read back in local time.
 */
export function localInputToISO(localInput: string, tz: string = LOCAL_TIMEZONE): string {
  // Compute the offset at the approximate target time (close enough; DST transitions mid-hour are rare)
  const approxDate = new Date(`${localInput}:00Z`);
  const offset = formatOffset(tz, approxDate);
  return new Date(`${localInput}:00${offset}`).toISOString();
}

/**
 * Formats a Date as a datetime-local input value ("YYYY-MM-DDTHH:mm") in the local timezone.
 * Counterpart to localInputToISO — use to pre-fill <input type="datetime-local">.
 */
export function dateToLocalInput(date: Date, tz: string = LOCAL_TIMEZONE): string {
  return date
    .toLocaleString("sv-SE", { timeZone: tz })
    .replace(" ", "T")
    .slice(0, 16);
}

// Backward-compat aliases (deprecated — prefer localInputToISO / dateToLocalInput)
export const artLocalInputToISO = localInputToISO;
export const dateToARTLocalInput = dateToLocalInput;
