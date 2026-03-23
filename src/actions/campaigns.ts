"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCronJob, deleteCronJob, getCampaignsEndpointUrl } from "@/lib/cronjob";

async function getDb() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

async function insertRecipients(db: unknown, campaignId: string, clientIds: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = db as any;
  if (clientIds.length > 0) {
    await client.from("campaign_recipients").insert(
      clientIds.map((clientId) => ({ campaign_id: campaignId, client_id: clientId }))
    );
    await client.from("campaigns").update({ total_recipients: clientIds.length }).eq("id", campaignId);
  }
}

export async function createCampaign(formData: FormData) {
  const db = await getDb();

  const targetAll = formData.get("target_all") === "true";
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("El nombre de la campaña es requerido");

  const body = (formData.get("body") as string) || "";
  const imageUrl = (formData.get("image_url") as string) || null;
  const scheduledAtRaw = formData.get("scheduled_at") as string | null;
  const scheduledAt = scheduledAtRaw ? new Date(`${scheduledAtRaw}:00-03:00`).toISOString() : null;

  const { data: campaign, error } = await db
    .from("campaigns")
    .insert({ name, body, image_url: imageUrl, status: "draft", scheduled_at: scheduledAt, target_all: targetAll })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (!targetAll) {
    const selectedIds = formData.getAll("client_ids") as string[];
    await insertRecipients(db, campaign.id, selectedIds);
  }

  revalidatePath("/backoffice/automatizaciones");
  redirect(`/backoffice/automatizaciones/${campaign.id}`);
}

/** Creates a new campaign and immediately marks it as scheduled (for new campaign "Programar envío" button). */
export async function createAndScheduleCampaign(formData: FormData) {
  const db = await getDb();

  const targetAll = formData.get("target_all") === "true";
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("El nombre de la campaña es requerido");

  const body = (formData.get("body") as string) || "";
  const imageUrl = (formData.get("image_url") as string) || null;
  const scheduledAtRaw = formData.get("scheduled_at") as string | null;
  if (!scheduledAtRaw) throw new Error("Configurá una fecha/hora de envío antes de programar");

  const scheduledAt = new Date(`${scheduledAtRaw}:00-03:00`).toISOString();

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("CRON_SECRET is not set");

  // Insert as draft first so we have an ID for the cron job title
  const { data: campaign, error } = await db
    .from("campaigns")
    .insert({ name, body, image_url: imageUrl, status: "draft", scheduled_at: scheduledAt, target_all: targetAll })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (!targetAll) {
    const selectedIds = formData.getAll("client_ids") as string[];
    await insertRecipients(db, campaign.id, selectedIds);
  }

  // Register the cron job before marking as scheduled to avoid orphaned state
  const jobId = await createCronJob({
    title: `Campaign ${campaign.id} — ${name}`,
    url: getCampaignsEndpointUrl(),
    scheduledAt: new Date(scheduledAt),
    authHeader: `Bearer ${cronSecret}`,
  });
  await db.from("campaigns").update({ status: "scheduled", cronjob_id: jobId }).eq("id", campaign.id);

  revalidatePath("/backoffice/automatizaciones");
  redirect(`/backoffice/automatizaciones/${campaign.id}`);
}

export async function updateCampaign(id: string, formData: FormData) {
  const db = await getDb();

  const { data: existing, error: fetchErr } = await db
    .from("campaigns")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);
  if (existing.status !== "draft") throw new Error("Solo se pueden editar campañas en estado borrador");

  const targetAll = formData.get("target_all") === "true";
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("El nombre de la campaña es requerido");

  const body = (formData.get("body") as string) || "";
  const imageUrl = (formData.get("image_url") as string) || null;
  const scheduledAtRaw = formData.get("scheduled_at") as string | null;
  const scheduledAt = scheduledAtRaw ? new Date(`${scheduledAtRaw}:00-03:00`).toISOString() : null;

  const { error } = await db
    .from("campaigns")
    .update({ name, body, image_url: imageUrl, scheduled_at: scheduledAt, target_all: targetAll })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (!targetAll) {
    // Replace recipients
    await db.from("campaign_recipients").delete().eq("campaign_id", id);
    const selectedIds = formData.getAll("client_ids") as string[];
    if (selectedIds.length > 0) {
      await db.from("campaign_recipients").insert(
        selectedIds.map((clientId) => ({ campaign_id: id, client_id: clientId }))
      );
      await db.from("campaigns").update({ total_recipients: selectedIds.length }).eq("id", id);
    } else {
      await db.from("campaigns").update({ total_recipients: 0 }).eq("id", id);
    }
  } else {
    // Remove manual recipients and reset count
    await db.from("campaign_recipients").delete().eq("campaign_id", id);
    await db.from("campaigns").update({ total_recipients: 0 }).eq("id", id);
  }

  revalidatePath("/backoffice/automatizaciones");
  revalidatePath(`/backoffice/automatizaciones/${id}`);
  redirect(`/backoffice/automatizaciones/${id}`);
}

export async function scheduleCampaign(id: string) {
  const db = await getDb();

  const { data: campaign, error: fetchErr } = await db
    .from("campaigns")
    .select("status, scheduled_at")
    .eq("id", id)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);
  if (campaign.status !== "draft") throw new Error("Solo se pueden programar campañas en estado borrador");
  if (!campaign.scheduled_at) throw new Error("Configurá una fecha/hora de envío antes de programar");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("CRON_SECRET is not set");

  // Register the cron job before marking as scheduled to avoid orphaned state
  const jobId = await createCronJob({
    title: `Campaign ${id}`,
    url: getCampaignsEndpointUrl(),
    scheduledAt: new Date(campaign.scheduled_at as string),
    authHeader: `Bearer ${cronSecret}`,
  });
  await db.from("campaigns").update({ status: "scheduled", cronjob_id: jobId }).eq("id", id);

  revalidatePath("/backoffice/automatizaciones");
  revalidatePath(`/backoffice/automatizaciones/${id}`);
  redirect(`/backoffice/automatizaciones/${id}`);
}

export async function cancelSchedule(id: string) {
  const db = await getDb();

  const { data: campaign, error: fetchErr } = await db
    .from("campaigns")
    .select("cronjob_id")
    .eq("id", id)
    .eq("status", "scheduled")
    .single();

  if (fetchErr) throw new Error(fetchErr.message);

  if (campaign?.cronjob_id) {
    await deleteCronJob(campaign.cronjob_id);
  }

  const { error } = await db
    .from("campaigns")
    .update({ status: "draft", cronjob_id: null })
    .eq("id", id)
    .eq("status", "scheduled");

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/automatizaciones");
  revalidatePath(`/backoffice/automatizaciones/${id}`);
  redirect(`/backoffice/automatizaciones/${id}`);
}

export async function deleteCampaign(id: string) {
  const db = await getDb();

  const { error } = await db
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("status", "draft");

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/automatizaciones");
  redirect("/backoffice/automatizaciones");
}

export async function cloneCampaign(id: string) {
  const db = await getDb();

  const { data: original, error: fetchErr } = await db
    .from("campaigns")
    .select("name, body, image_url, target_all")
    .eq("id", id)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);

  const { data: clone, error: insertErr } = await db
    .from("campaigns")
    .insert({
      name: `${original.name} (copia)`,
      body: original.body,
      image_url: original.image_url,
      target_all: original.target_all,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(insertErr.message);

  // Clone recipients if manual selection
  if (!original.target_all) {
    const { data: recipients } = await db
      .from("campaign_recipients")
      .select("client_id")
      .eq("campaign_id", id);

    if (recipients && recipients.length > 0) {
      await db.from("campaign_recipients").insert(
        recipients.map((r: { client_id: string }) => ({ campaign_id: clone.id, client_id: r.client_id }))
      );
      await db.from("campaigns").update({ total_recipients: recipients.length }).eq("id", clone.id);
    }
  }

  revalidatePath("/backoffice/automatizaciones");
  redirect(`/backoffice/automatizaciones/${clone.id}/editar`);
}

export async function uploadCampaignImage(formData: FormData): Promise<{ url: string }> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storage = (supabase as any).storage;

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await storage
    .from("campaign-images")
    .upload(fileName, buffer, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  const { data } = storage.from("campaign-images").getPublicUrl(fileName);
  return { url: data.publicUrl };
}
