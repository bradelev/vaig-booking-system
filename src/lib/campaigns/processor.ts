import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateMessage } from "@/lib/whatsapp/logged";
import { sanitizeTemplateParam } from "@/lib/whatsapp/sanitize";

const DELAY_MS = 100;
const STUCK_SENDING_MINUTES = 30;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processDueCampaigns(): Promise<{ processed: number; errors: string[] }> {
  const db = createAdminClient();

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
    .select("id, name, body, image_url, target_all, total_recipients")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  if (fetchError) {
    return { processed: 0, errors: [`Failed to fetch campaigns: ${fetchError.message}`] };
  }

  type CampaignRow = {
    id: string;
    name: string;
    body: string;
    image_url: string | null;
    target_all: boolean;
    total_recipients: number | null;
  };

  for (const campaign of (campaigns ?? []) as unknown as CampaignRow[]) {
    // Mark as sending
    await db.from("campaigns").update({ status: "sending" }).eq("id", campaign.id);

    try {
      // Resolve recipients
      let recipients: Array<{ id: string; phone: string; first_name: string }> = [];

      if (campaign.target_all) {
        const { data } = await db
          .from("clients")
          .select("id, phone, first_name")
          .eq("is_blocked", false);
        recipients = (data ?? []) as unknown as Array<{ id: string; phone: string; first_name: string }>;
      } else {
        // Join through campaign_recipients to filter to manually selected clients
        const { data } = await db
          .from("campaign_recipients")
          .select("clients!inner(id, phone, first_name, is_blocked)")
          .eq("campaign_id", campaign.id)
          .eq("clients.is_blocked", false);
        type RecipientRow = { clients: { id: string; phone: string; first_name: string } | null };
        recipients = ((data ?? []) as unknown as RecipientRow[])
          .map((r) => r.clients)
          .filter(Boolean) as Array<{ id: string; phone: string; first_name: string }>;
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
            status: "failed",
            error: "Placeholder phone — no real number",
          });
          continue;
        }

        try {
          const components: Array<Record<string, unknown>> = [];

          if (campaign.image_url) {
            components.push({
              type: "header",
              parameters: [{ type: "image", image: { link: campaign.image_url } }],
            });
          }

          components.push({
            type: "body",
            parameters: [
              { type: "text", text: sanitizeTemplateParam(recipient.first_name || "cliente") },
              { type: "text", text: sanitizeTemplateParam(campaign.body) },
            ],
          });

          const waMessageId = await sendTemplateMessage({
            to: recipient.phone,
            templateName: campaign.image_url ? "campana_general_con_imagen" : "campana_general",
            languageCode: "es_UY",
            components,
          }, "campaign");

          sentCount++;
          await db.from("campaign_recipients").upsert({
            campaign_id: campaign.id,
            client_id: recipient.id,
            wa_message_id: waMessageId,
            status: "sent",
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
      }).eq("id", campaign.id);

      processed++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Campaign ${campaign.id}: ${errMsg}`);
      await db.from("campaigns").update({ status: "failed" }).eq("id", campaign.id);
    }
  }

  return { processed, errors };
}
