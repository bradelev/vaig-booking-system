import { createAdminClient } from "@/lib/supabase/admin";
import { sendTextMessage, sendImageMessage } from "@/lib/whatsapp";
import { deleteCronJob } from "@/lib/cronjob";

const DELAY_MS = 100;
const STUCK_SENDING_MINUTES = 30;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processDueCampaigns(): Promise<{ processed: number; errors: string[] }> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const errors: string[] = [];
  let processed = 0;

  // Recover campaigns stuck in "sending" for too long (e.g. killed by timeout)
  const staleThreshold = new Date(Date.now() - STUCK_SENDING_MINUTES * 60 * 1000).toISOString();
  await db
    .from("campaigns")
    .update({ status: "failed" })
    .eq("status", "sending")
    .lt("updated_at", staleThreshold);

  // Fetch campaigns due for sending
  const { data: campaigns, error: fetchError } = await db
    .from("campaigns")
    .select("id, name, body, image_url, target_all, total_recipients, cronjob_id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  if (fetchError) {
    return { processed: 0, errors: [`Failed to fetch campaigns: ${fetchError.message}`] };
  }

  for (const campaign of campaigns ?? []) {
    // Mark as sending
    await db.from("campaigns").update({ status: "sending" }).eq("id", campaign.id);

    try {
      // Resolve recipients
      let recipients: Array<{ id: string; phone: string }> = [];

      if (campaign.target_all) {
        const { data } = await db
          .from("clients")
          .select("id, phone")
          .eq("is_blocked", false);
        recipients = data ?? [];
      } else {
        // Join through campaign_recipients — also enforce consent
        const { data } = await db
          .from("campaign_recipients")
          .select("clients!inner(id, phone, is_blocked)")
          .eq("campaign_id", campaign.id)
          .eq("clients.is_blocked", false);
        recipients = (data ?? [])
          .map((r: { clients: { id: string; phone: string } | null }) => r.clients)
          .filter(Boolean) as Array<{ id: string; phone: string }>;
      }

      const totalRecipients = recipients.length;
      let sentCount = 0;
      let failedCount = 0;

      // Update total count
      await db.from("campaigns").update({ total_recipients: totalRecipients }).eq("id", campaign.id);

      // Send messages
      for (const recipient of recipients) {
        // Skip placeholder phones (historical/migrated clients without real phone)
        if (
          recipient.phone.startsWith("historico_") ||
          recipient.phone.startsWith("migrated_nophone_")
        ) {
          failedCount++;
          await db.from("campaign_recipients").upsert({
            campaign_id: campaign.id,
            client_id: recipient.id,
            error: "Placeholder phone — no real number",
          });
          continue;
        }

        try {
          if (campaign.image_url) {
            await sendImageMessage({
              to: recipient.phone,
              imageUrl: campaign.image_url,
              caption: campaign.body || undefined,
            });
          } else {
            await sendTextMessage({ to: recipient.phone, body: campaign.body });
          }

          sentCount++;
          await db.from("campaign_recipients").upsert({
            campaign_id: campaign.id,
            client_id: recipient.id,
            sent_at: new Date().toISOString(),
            error: null,
          });
        } catch (err) {
          failedCount++;
          const errMsg = err instanceof Error ? err.message : String(err);
          await db.from("campaign_recipients").upsert({
            campaign_id: campaign.id,
            client_id: recipient.id,
            error: errMsg,
          });
        }

        await sleep(DELAY_MS);
      }

      const finalStatus = failedCount > 0 && sentCount === 0 ? "failed" : "completed";
      await db.from("campaigns").update({
        status: finalStatus,
        sent_count: sentCount,
        failed_count: failedCount,
        total_recipients: totalRecipients,
        completed_at: new Date().toISOString(),
        cronjob_id: null,
      }).eq("id", campaign.id);

      // Clean up the cron job if it still exists (e.g. processor ran before expiry)
      if (campaign.cronjob_id) {
        await deleteCronJob(campaign.cronjob_id).catch(() => {});
      }

      processed++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Campaign ${campaign.id}: ${errMsg}`);
      await db.from("campaigns").update({ status: "failed" }).eq("id", campaign.id);
    }
  }

  return { processed, errors };
}
