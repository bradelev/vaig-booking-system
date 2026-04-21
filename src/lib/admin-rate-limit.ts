import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

// Prefix to avoid collisions with bot entries in rate_limit_log (which use phone numbers)
function adminKey(userId: string): string {
  return `admin:${userId}`;
}

export async function checkAdminRateLimit(
  userId: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any;
  const key = adminKey(userId);
  const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1_000).toISOString();

  const { data: rows } = await client
    .from("rate_limit_log")
    .select("id, message_count, window_start")
    .eq("phone", key)
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .limit(1);

  const currentCount: number = rows?.[0]?.message_count ?? 0;
  const rowId: string | null = rows?.[0]?.id ?? null;

  if (currentCount >= MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
  }

  if (rowId) {
    await client
      .from("rate_limit_log")
      .update({ message_count: currentCount + 1 })
      .eq("id", rowId);
  } else {
    await client.from("rate_limit_log").insert({
      phone: key,
      message_count: 1,
      window_start: new Date().toISOString(),
    });
  }

  return { allowed: true };
}
