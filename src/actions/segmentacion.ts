"use server";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COOLDOWN_DAYS } from "@/lib/campaigns/constants";

async function getDb() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

export interface SegmentationFilterCriteria {
  segmentos?: string[];
  categorias?: string[];
  serviceCategories?: string[];
  totalSesionesMin?: number | null;
  totalSesionesMax?: number | null;
  diasInactivoMin?: number | null;
  diasInactivoMax?: number | null;
  ticketPromedioMin?: number | null;
  ticketPromedioMax?: number | null;
  sources?: string[];
  soloOportunidadCrossSell?: boolean;
  soloCandidataReactivacion?: boolean;
  excluirContactadasRecientemente?: boolean;
  cooldownDias?: number;
}

export interface SegmentationClient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  segmento: string | null;
  categoria: string | null;
  total_sesiones: number;
  dias_inactivo: number | null;
  ticket_promedio: number | null;
  source: string | null;
  oportunidad_cross_sell: boolean;
  candidata_reactivacion: boolean;
  dias_desde_ultima_campana?: number | null;
}

export async function filterSegmentationClients(
  criteria: SegmentationFilterCriteria
): Promise<{ clients: SegmentationClient[]; count: number }> {
  const db = await getDb();

  const cooldownDays = criteria.cooldownDias ?? DEFAULT_COOLDOWN_DAYS;
  const shouldExcludeCooldown = criteria.excluirContactadasRecientemente !== false;

  // Exclude clients with a booking in the next 14 days
  const { data: upcomingBookings } = await db
    .from("bookings")
    .select("client_id")
    .in("status", ["confirmed", "pending", "deposit_paid"])
    .gte("scheduled_at", new Date().toISOString())
    .lte("scheduled_at", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString());

  const excludedIds: string[] = upcomingBookings
    ? [...new Set((upcomingBookings as { client_id: string }[]).map((b) => b.client_id))]
    : [];

  // Cooldown: fetch recent campaign sends to compute dias_desde_ultima_campana
  // Always fetch so the column can be shown even when cooldown filter is OFF
  const cooldownMap: Record<string, number> = {};
  const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRecipients } = await db
    .from("campaign_recipients")
    .select("client_id, sent_at")
    .not("sent_at", "is", null);

  if (recentRecipients) {
    // Build a map of client_id -> most recent sent_at (all time)
    const latestSentMap: Record<string, string> = {};
    for (const r of recentRecipients as { client_id: string; sent_at: string }[]) {
      if (!latestSentMap[r.client_id] || r.sent_at > latestSentMap[r.client_id]) {
        latestSentMap[r.client_id] = r.sent_at;
      }
    }
    const now = Date.now();
    for (const [clientId, sentAt] of Object.entries(latestSentMap)) {
      const days = Math.floor((now - new Date(sentAt).getTime()) / (1000 * 60 * 60 * 24));
      cooldownMap[clientId] = days;
    }

    if (shouldExcludeCooldown) {
      for (const r of recentRecipients as { client_id: string; sent_at: string }[]) {
        if (r.sent_at >= cooldownCutoff) {
          if (!excludedIds.includes(r.client_id)) {
            excludedIds.push(r.client_id);
          }
        }
      }
    }
  }

  let query = db
    .from("clientes_metricas")
    .select(
      "id, first_name, last_name, phone, segmento, categoria, total_sesiones, dias_inactivo, ticket_promedio, source, oportunidad_cross_sell, candidata_reactivacion",
      { count: "exact" }
    )
    .eq("is_blocked", false);

  if (excludedIds.length > 0) {
    query = query.not("id", "in", `(${excludedIds.join(",")})`);
  }

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
  if (criteria.ticketPromedioMin != null) {
    query = query.gte("ticket_promedio", criteria.ticketPromedioMin);
  }
  if (criteria.ticketPromedioMax != null) {
    query = query.lte("ticket_promedio", criteria.ticketPromedioMax);
  }
  if (criteria.sources?.length) {
    query = query.in("source", criteria.sources);
  }
  if (criteria.soloOportunidadCrossSell) {
    query = query.eq("oportunidad_cross_sell", true);
  }
  if (criteria.soloCandidataReactivacion) {
    query = query.eq("candidata_reactivacion", true);
  }

  const { data, count, error } = await query.order("first_name").limit(500);
  if (error) throw new Error(error.message);

  // Augment results with cooldown data
  const clients = (data ?? []).map((c: SegmentationClient) => ({
    ...c,
    dias_desde_ultima_campana: cooldownMap[c.id] ?? null,
  }));

  return { clients, count: count ?? 0 };
}
