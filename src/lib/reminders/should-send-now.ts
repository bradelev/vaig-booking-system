import { getARTComponents } from "@/lib/timezone";

const SEND_HOUR = 9; // 9 AM local time

/**
 * Returns true if a booking's reminder should be dispatched right now.
 *
 * Rules:
 *  - Booking is TODAY (local) and scheduled time >= 09:00 local → send on the day at 9 AM.
 *  - Booking is TOMORROW (local) and scheduled time < 09:00 local → send today at 9 AM (day-before advance).
 *
 * This function is called from the cron that runs at 09:00 local time (12:00 UTC for UYT/UTC-3).
 * It is also safe to call at other times — the cron window is 0–48h look-ahead and the
 * confirmation_sent_at flag makes it idempotent.
 *
 * @param scheduledAt - ISO timestamp of the booking (UTC)
 * @param now         - Current time (injectable for testing)
 * @param tz          - IANA timezone string (e.g. "America/Montevideo")
 */
export function shouldSendNow(
  scheduledAt: string,
  now: Date,
  tz: string
): boolean {
  const bookingDate = new Date(scheduledAt);
  const booking = getARTComponents(bookingDate, tz);
  const current = getARTComponents(now, tz);

  const bookingDayStr = `${booking.year}-${booking.month}-${booking.day}`;
  const currentDayStr = `${current.year}-${current.month}-${current.day}`;

  // tomorrow's date string
  const tomorrowDate = new Date(now.getTime() + 86_400_000);
  const tomorrow = getARTComponents(tomorrowDate, tz);
  const tomorrowDayStr = `${tomorrow.year}-${tomorrow.month}-${tomorrow.day}`;

  const bookingTimeMinutes = booking.hour * 60 + booking.minute;
  const sendThresholdMinutes = SEND_HOUR * 60; // 540

  if (bookingDayStr === currentDayStr) {
    // Booking is today: only send if service is at or after 9 AM (services before 9 AM were covered yesterday)
    return bookingTimeMinutes >= sendThresholdMinutes;
  }

  if (bookingDayStr === tomorrowDayStr) {
    // Booking is tomorrow: only send today if the service is before 9 AM (advance reminder)
    return bookingTimeMinutes < sendThresholdMinutes;
  }

  return false;
}
