/**
 * VBS-29 — Rate limiting for the WhatsApp bot.
 * Uses the rate_limit_log table to track message count per phone per time window.
 *
 * Default limits (overridable via system_config):
 *   rate_limit_window_minutes  — rolling window (default: 60)
 *   rate_limit_max_messages    — max messages in the window (default: 30)
 */
import { createClient } from "@/lib/supabase/server";
import { getConfigValue } from "@/lib/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(phone: string): Promise<RateLimitResult> {
  const [windowMinutesStr, maxMessagesStr] = await Promise.all([
    getConfigValue("rate_limit_window_minutes", "60"),
    getConfigValue("rate_limit_max_messages", "30"),
  ]);

  const windowMinutes = Math.max(1, parseInt(windowMinutesStr) || 60);
  const maxMessages = Math.max(1, parseInt(maxMessagesStr) || 30);

  const supabase = await createClient();
  const client = supabase as AnyClient;

  const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  // Count messages in current window
  const { data: rows } = await client
    .from("rate_limit_log")
    .select("id, message_count, window_start")
    .eq("phone", phone)
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .limit(1);

  const currentCount: number = rows?.[0]?.message_count ?? 0;
  const rowId: string | null = rows?.[0]?.id ?? null;

  if (currentCount >= maxMessages) {
    return { allowed: false, remaining: 0 };
  }

  // Upsert the counter
  if (rowId) {
    await client
      .from("rate_limit_log")
      .update({ message_count: currentCount + 1 })
      .eq("id", rowId);
  } else {
    await client.from("rate_limit_log").insert({
      phone,
      message_count: 1,
      window_start: new Date().toISOString(),
    });
  }

  return { allowed: true, remaining: maxMessages - currentCount - 1 };
}
