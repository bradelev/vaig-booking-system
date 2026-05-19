import { getARTComponents } from "@/lib/timezone";

export type RelativeLabel = {
  /** Short label for UI grouping: "Hoy", "Mañana", "Sábado 24/05" */
  label: string;
  /** Clause to embed in the reminder message: "hoy a las 14:30", "mañana a las 08:00", "el sábado 24/05 a las 14:30" */
  clauseEs: string;
};

/**
 * Returns a human-readable relative label and a Spanish clause for use in reminder messages.
 *
 * @param scheduledAt - ISO timestamp of the booking (UTC)
 * @param tz          - IANA timezone string (e.g. "America/Montevideo")
 * @param now         - Current time (injectable for testing)
 */
export function relativeDayLabel(
  scheduledAt: string,
  tz: string,
  now: Date = new Date()
): RelativeLabel {
  const bookingDate = new Date(scheduledAt);
  const { day: bDay, month: bMonth, hour: bHour, minute: bMinute } = getARTComponents(bookingDate, tz);
  const { day: nDay, month: nMonth, year: nYear } = getARTComponents(now, tz);
  const { day: tDay, month: tMonth } = getARTComponents(new Date(now.getTime() + 86_400_000), tz);

  const timeStr = `${String(bHour).padStart(2, "0")}:${String(bMinute).padStart(2, "0")}`;

  // Check same calendar day in local tz
  const isToday = bDay === nDay && bMonth === nMonth;
  if (isToday) {
    return { label: "Hoy", clauseEs: `hoy a las ${timeStr}` };
  }

  // Tomorrow in local tz — computed by adding 1 day worth of ms and checking components
  const isTomorrow = bDay === tDay && bMonth === tMonth;
  if (isTomorrow) {
    return { label: "Mañana", clauseEs: `mañana a las ${timeStr}` };
  }

  // Farther days: show weekday + DD/MM using the booking year for cross-year edge case
  const { year: bYear } = getARTComponents(bookingDate, tz);
  const dateForFormat = new Date(`${bYear}-${String(bMonth).padStart(2, "0")}-${String(bDay).padStart(2, "0")}T12:00:00Z`);
  const weekday = dateForFormat.toLocaleDateString("es-UY", {
    timeZone: "UTC",
    weekday: "long",
  });
  // Capitalize first letter
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const ddmm = `${String(bDay).padStart(2, "0")}/${String(bMonth).padStart(2, "0")}`;

  // Show year suffix only if different from current year (edge case near year boundary)
  const yearSuffix = bYear !== nYear ? `/${bYear}` : "";
  const dateLabel = `${weekdayCap} ${ddmm}${yearSuffix}`;

  return {
    label: dateLabel,
    clauseEs: `el ${weekday} ${ddmm}${yearSuffix} a las ${timeStr}`,
  };
}
