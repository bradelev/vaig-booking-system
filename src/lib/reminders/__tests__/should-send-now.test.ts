import { describe, it, expect } from "vitest";
import { shouldSendNow } from "../should-send-now";

const TZ = "America/Montevideo";

// "Now" = 2026-05-19T09:00 Uruguay (= 2026-05-19T12:00:00Z, UYT UTC-3)
// This simulates the cron running at 9 AM local.
const NOW_9AM = new Date("2026-05-19T12:00:00.000Z");

describe("shouldSendNow", () => {
  it("returns true for booking today at 14:00 local (>= 9 AM)", () => {
    const scheduled = "2026-05-19T17:00:00.000Z"; // 14:00 Uruguay
    expect(shouldSendNow(scheduled, NOW_9AM, TZ)).toBe(true);
  });

  it("returns true for booking today at exactly 09:00 local", () => {
    const scheduled = "2026-05-19T12:00:00.000Z"; // 09:00 Uruguay
    expect(shouldSendNow(scheduled, NOW_9AM, TZ)).toBe(true);
  });

  it("returns false for booking today at 08:00 local (before 9 AM — yesterday cron covered it)", () => {
    const scheduled = "2026-05-19T11:00:00.000Z"; // 08:00 Uruguay
    expect(shouldSendNow(scheduled, NOW_9AM, TZ)).toBe(false);
  });

  it("returns true for booking tomorrow at 08:00 local (advance reminder for early service)", () => {
    const scheduled = "2026-05-20T11:00:00.000Z"; // 08:00 Uruguay next day
    expect(shouldSendNow(scheduled, NOW_9AM, TZ)).toBe(true);
  });

  it("returns false for booking tomorrow at 14:00 local (will be sent tomorrow at 9 AM)", () => {
    const scheduled = "2026-05-20T17:00:00.000Z"; // 14:00 Uruguay next day
    expect(shouldSendNow(scheduled, NOW_9AM, TZ)).toBe(false);
  });

  it("returns false for booking tomorrow at exactly 09:00 local (will be sent tomorrow)", () => {
    const scheduled = "2026-05-20T12:00:00.000Z"; // 09:00 Uruguay next day
    expect(shouldSendNow(scheduled, NOW_9AM, TZ)).toBe(false);
  });

  it("returns false for booking in 2 days", () => {
    const scheduled = "2026-05-21T17:00:00.000Z"; // 14:00 Uruguay +2 days
    expect(shouldSendNow(scheduled, NOW_9AM, TZ)).toBe(false);
  });

  it("returns false for booking yesterday (already past)", () => {
    const scheduled = "2026-05-18T17:00:00.000Z"; // yesterday Uruguay
    expect(shouldSendNow(scheduled, NOW_9AM, TZ)).toBe(false);
  });

  it("handles cron running slightly after 9 AM (e.g. 9:02 AM)", () => {
    const now902 = new Date("2026-05-19T12:02:00.000Z"); // 9:02 AM Uruguay
    const scheduled = "2026-05-19T17:00:00.000Z"; // 14:00 today
    expect(shouldSendNow(scheduled, now902, TZ)).toBe(true);
  });

  it("returns true for midnight booking tomorrow (00:00 local = advance)", () => {
    const scheduled = "2026-05-20T03:00:00.000Z"; // 00:00 Uruguay tomorrow
    expect(shouldSendNow(scheduled, NOW_9AM, TZ)).toBe(true);
  });
});
