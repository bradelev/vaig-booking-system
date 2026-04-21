import { createAdminClient } from "@/lib/supabase/admin";
import type { MessageRow, MessageStatus } from "@/lib/whatsapp/log";

type RecipientRow = {
  campaign_id: string;
  client_id: string;
  status: string;
};

/**
 * Called after every delivery webhook for a campaign message.
 * Updates campaign_recipients status and recomputes campaigns.sent_count / failed_count
 * from DB truth — avoiding count drift from out-of-order webhook delivery.
 */
export async function reconcileCampaignRecipientFromMessage(
  messageRow: MessageRow,
  status: MessageStatus,
  errorCode: number | null,
  errorMessage: string | null
): Promise<void> {
  if (messageRow.source !== "campaign" || !messageRow.wa_message_id) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // Lookup recipient by wa_message_id
  const { data: recipient } = await db
    .from("campaign_recipients")
    .select("campaign_id, client_id, status")
    .eq("wa_message_id", messageRow.wa_message_id)
    .maybeSingle() as { data: RecipientRow | null };

  if (!recipient) return;

  // Build update — never downgrade a terminal status (failed stays failed)
  const currentStatus = recipient.status;
  const STATUS_ORDER = ["pending", "sent", "delivered", "read", "failed"];
  const isTerminal = (s: string) => s === "failed";

  // failed is always terminal; for other statuses only advance (don't go backwards)
  if (
    isTerminal(currentStatus) && status !== "failed"
  ) return;

  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const newIdx = STATUS_ORDER.indexOf(status);
  if (status !== "failed" && newIdx <= currentIdx) return;

  const update: Record<string, unknown> = { status };

  if (status === "failed") {
    update.sent_at = null;
    update.error_code = errorCode;
    update.error = errorMessage;
  } else if (status === "delivered") {
    update.delivered_at = new Date().toISOString();
  } else if (status === "read") {
    update.read_at = new Date().toISOString();
  }

  await db
    .from("campaign_recipients")
    .update(update)
    .eq("campaign_id", recipient.campaign_id)
    .eq("client_id", recipient.client_id);

  // Recompute campaign counts from truth
  const { data: counts } = await db
    .from("campaign_recipients")
    .select("status")
    .eq("campaign_id", recipient.campaign_id) as { data: Array<{ status: string }> | null };

  if (!counts) return;

  const sentCount = counts.filter((r) => r.status !== "failed" && r.status !== "pending").length;
  const failedCount = counts.filter((r) => r.status === "failed").length;

  await db
    .from("campaigns")
    .update({ sent_count: sentCount, failed_count: failedCount })
    .eq("id", recipient.campaign_id);
}
