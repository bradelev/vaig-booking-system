/**
 * Timezone helpers for Argentina (UTC-3, no DST).
 * All helpers produce Date objects or components in ART (Argentina Time).
 *
 * Argentina does not observe Daylight Saving Time, so the offset is
 * always fixed at UTC-3.
 */

/** Returns a Date representing midnight ART for the given date */
export function artMidnight(date: Date): Date {
  const dateStr = date.toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return new Date(`${dateStr}T00:00:00-03:00`);
}

/** Returns ART components (year, month, day, hour, minute, dayOfWeek) for a Date */
export function getARTComponents(date: Date): {
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
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
  });
  const weekdayMatch = str.match(/^(\w+)/);
  const dayOfWeek =
    weekdayMatch ? (dayNames[weekdayMatch[1]] ?? 0) : 0;

  const dateParts = date
    .toLocaleDateString("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires",
    })
    .split("-")
    .map(Number);
  const [year, month, day] = dateParts;

  const timeParts = date
    .toLocaleTimeString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .split(":")
    .map(Number);
  const [hour, minute] = timeParts;

  return { year, month, day, hour, minute, dayOfWeek };
}

/** Creates a Date for a specific date + time in ART */
export function artDateTime(dateInART: Date, hour: number, minute: number): Date {
  const dateStr = dateInART.toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return new Date(
    `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`
  );
}
