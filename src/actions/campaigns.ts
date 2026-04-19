"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { v2 as cloudinary } from "cloudinary";
import { localInputToISO } from "@/lib/timezone";

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  throw new Error("Missing required Cloudinary environment variables");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function getDb() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

function parseFilterCriteria(formData: FormData): CampaignFilterCriteria | null {
  const raw = formData.get("filter_criteria") as string | null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CampaignFilterCriteria;
  } catch {
    return null;
  }
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
  const scheduledAt = scheduledAtRaw ? localInputToISO(scheduledAtRaw!) : null;

  const filterCriteria = parseFilterCriteria(formData);

  const { data: campaign, error } = await db
    .from("campaigns")
    .insert({ name, body, image_url: imageUrl, status: "draft", scheduled_at: scheduledAt, target_all: targetAll, filter_criteria: filterCriteria })
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

  const scheduledAt = localInputToISO(scheduledAtRaw!);

  const filterCriteria = parseFilterCriteria(formData);

  // Insert as draft first so we have an ID
  const { data: campaign, error } = await db
    .from("campaigns")
    .insert({ name, body, image_url: imageUrl, status: "draft", scheduled_at: scheduledAt, target_all: targetAll, filter_criteria: filterCriteria })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (!targetAll) {
    const selectedIds = formData.getAll("client_ids") as string[];
    await insertRecipients(db, campaign.id, selectedIds);
  }

  const scheduledDate = new Date(scheduledAt);
  if (scheduledDate.getTime() < Date.now() - 60_000) {
    await db.from("campaigns").delete().eq("id", campaign.id);
    throw new Error("La fecha de envío ya pasó. Editá la campaña y configurá una nueva fecha.");
  }

  // pg_cron polls /api/internal/campaigns every minute — just mark as scheduled
  await db.from("campaigns").update({ status: "scheduled" }).eq("id", campaign.id);

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
  const scheduledAt = scheduledAtRaw ? localInputToISO(scheduledAtRaw!) : null;

  const filterCriteria = parseFilterCriteria(formData);

  const { error } = await db
    .from("campaigns")
    .update({ name, body, image_url: imageUrl, scheduled_at: scheduledAt, target_all: targetAll, filter_criteria: filterCriteria })
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

  const scheduledDate = new Date(campaign.scheduled_at as string);
  if (scheduledDate.getTime() < Date.now() - 60_000) {
    throw new Error("La fecha de envío ya pasó. Editá la campaña y configurá una nueva fecha.");
  }

  // pg_cron polls /api/internal/campaigns every minute — just mark as scheduled
  await db.from("campaigns").update({ status: "scheduled" }).eq("id", id);

  revalidatePath("/backoffice/automatizaciones");
  revalidatePath(`/backoffice/automatizaciones/${id}`);
  redirect(`/backoffice/automatizaciones/${id}`);
}

export async function cancelSchedule(id: string) {
  const db = await getDb();

  const { error } = await db
    .from("campaigns")
    .update({ status: "draft" })
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
    .select("name, body, image_url, target_all, filter_criteria")
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
      filter_criteria: original.filter_criteria,
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

export interface CampaignFilterCriteria {
  segmentos?: string[];
  categorias?: string[];
  serviceCategories?: string[];
  totalSesionesMin?: number | null;
  totalSesionesMax?: number | null;
  diasInactivoMin?: number | null;
  diasInactivoMax?: number | null;
}

export interface FilteredClient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  segmento: string | null;
  categoria: string | null;
  total_sesiones: number;
  dias_inactivo: number | null;
}

export async function filterCampaignClients(
  criteria: CampaignFilterCriteria
): Promise<{ clients: FilteredClient[]; count: number }> {
  const db = await getDb();

  let query = db
    .from("clientes_metricas")
    .select(
      "id, first_name, last_name, phone, segmento, categoria, total_sesiones, dias_inactivo",
      { count: "exact" }
    )
    .eq("is_blocked", false);

  if (criteria.segmentos?.length) {
    const hasNone = criteria.segmentos.includes("none");
    const real = criteria.segmentos.filter((s) => s !== "none");
    if (hasNone && real.length) {
      query = query.or(`segmento.in.(${real.join(",")}),segmento.is.null`);
    } else if (hasNone) {
      query = query.is("segmento", null);
    } else {
      query = query.in("segmento", real);
    }
  }

  if (criteria.categorias?.length) {
    query = query.in("categoria", criteria.categorias);
  }

  if (criteria.serviceCategories?.length) {
    const { data: services } = await db
      .from("services")
      .select("name")
      .in("category", criteria.serviceCategories);
    const names = (services ?? []).map((s: { name: string }) => s.name);
    if (names.length > 0) {
      query = query.overlaps("servicios_usados", names);
    }
  }

  if (criteria.diasInactivoMin != null) {
    query = query.gte("dias_inactivo", criteria.diasInactivoMin);
  }
  if (criteria.diasInactivoMax != null) {
    query = query.lte("dias_inactivo", criteria.diasInactivoMax);
  }
  if (criteria.totalSesionesMin != null) {
    query = query.gte("total_sesiones", criteria.totalSesionesMin);
  }
  if (criteria.totalSesionesMax != null) {
    query = query.lte("total_sesiones", criteria.totalSesionesMax);
  }

  const { data, count, error } = await query.order("first_name").limit(500);
  if (error) throw new Error(error.message);

  return { clients: (data ?? []) as FilteredClient[], count: count ?? 0 };
}

export async function updateClientPhone(clientId: string, phone: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("clients").update({ phone }).eq("id", clientId);
  if (error) throw new Error(error.message);
}

export async function uploadCampaignImage(formData: FormData): Promise<{ url: string }> {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campaign-images",
        transformation: [{ width: 800, quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed"));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

  return { url: result.secure_url };
}
