/**
 * Campaign context injection for the bot.
 *
 * When a client sends a message, checks whether they received a campaign in
 * the last 48 hours. If so, returns the campaign name and body so the bot can
 * use it as context in the greeting and intent detection.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface RecentCampaign {
  name: string;
  body: string;
  sentAt: string; // ISO string
}

const CAMPAIGN_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Returns the most recent campaign successfully sent to this phone within 48h,
 * or null if none found.
 *
 * Non-fatal: any DB error returns null silently to avoid blocking the bot.
 */
export async function getRecentCampaignForPhone(
  phone: string
): Promise<RecentCampaign | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    const windowStart = new Date(Date.now() - CAMPAIGN_WINDOW_MS).toISOString();

    // Join campaign_recipients → clients (by phone) → campaigns
    const { data, error } = await db
      .from("campaign_recipients")
      .select(
        "sent_at, campaigns!inner(name, body), clients!inner(phone)"
      )
      .eq("clients.phone", phone)
      .not("sent_at", "is", null)
      .gte("sent_at", windowStart)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const campaign = data.campaigns as { name: string; body: string };
    if (!campaign?.name) return null;

    return {
      name: campaign.name,
      body: campaign.body ?? "",
      sentAt: data.sent_at as string,
    };
  } catch {
    // Never block the bot on a campaign lookup failure
    return null;
  }
}
