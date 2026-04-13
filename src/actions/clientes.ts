"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length < b.length) [a, b] = [b, a];
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      curr.push(Math.min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (a[i] !== b[j] ? 1 : 0)));
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
}

export interface ClienteResumen {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  nombre_normalizado: string | null;
  total_sesiones: number;
}

export interface ParDuplicado {
  a: ClienteResumen;
  b: ClienteResumen;
  distancia: number; // 0 = mismo nombre_normalizado, 1-2 = typo
}

export async function getDuplicadosCandidatos(): Promise<ParDuplicado[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch all clients with session count from the view
  const { data: rawClientes } = await sb
    .from("clientes_metricas")
    .select("id, first_name, last_name, phone, nombre_normalizado, total_sesiones")
    .order("first_name", { ascending: true })
    .limit(2000);

  const clientes = (rawClientes ?? []) as ClienteResumen[];

  // Normalize helper (strip accents, lowercase, alphanumeric+spaces only)
  function norm(s: string): string {
    return s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
  }

  const pairs: ParDuplicado[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < clientes.length; i++) {
    for (let j = i + 1; j < clientes.length; j++) {
      const a = clientes[i];
      const b = clientes[j];
      const normA = norm(`${a.first_name} ${a.last_name}`);
      const normB = norm(`${b.first_name} ${b.last_name}`);

      // Must be multi-word names to avoid false positives
      if (normA.split(" ").length < 2 || normB.split(" ").length < 2) continue;

      const dist = levenshtein(normA, normB);
      if (dist > 2) continue;

      const key = [a.id, b.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      pairs.push({ a, b, distancia: dist });
    }
  }

  // Sort: exact matches first, then by distance
  pairs.sort((x, y) => x.distancia - y.distancia);
  return pairs;
}

export async function mergeClients(keepId: string, deleteId: string): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // 1. Reasignar sesiones_historicas — ignorar conflictos de unicidad (ON CONFLICT DO NOTHING via upsert skip)
  const { data: sesiones } = await sb
    .from("sesiones_historicas")
    .select("id, fecha, tipo_servicio, descripcion")
    .eq("client_id", deleteId);

  if (sesiones && sesiones.length > 0) {
    // Get existing sessions for keepId to avoid duplicates
    const { data: existentes } = await sb
      .from("sesiones_historicas")
      .select("fecha, tipo_servicio, descripcion")
      .eq("client_id", keepId);

    const existenteSet = new Set(
      (existentes ?? []).map(
        (s: { fecha: string; tipo_servicio: string; descripcion: string | null }) =>
          `${s.fecha}|${s.tipo_servicio}|${s.descripcion ?? ""}`
      )
    );

    const idsAMover = sesiones
      .filter((s: { id: string; fecha: string; tipo_servicio: string; descripcion: string | null }) =>
        !existenteSet.has(`${s.fecha}|${s.tipo_servicio}|${s.descripcion ?? ""}`)
      )
      .map((s: { id: string }) => s.id);

    if (idsAMover.length > 0) {
      const { error: errSes } = await sb
        .from("sesiones_historicas")
        .update({ client_id: keepId })
        .in("id", idsAMover);
      if (errSes) throw new Error(`Error reasignando sesiones: ${errSes.message}`);
    }
  }

  // 2. Reasignar bookings
  const { error: errBook } = await sb
    .from("bookings")
    .update({ client_id: keepId })
    .eq("client_id", deleteId);
  if (errBook) throw new Error(`Error reasignando bookings: ${errBook.message}`);

  // 3. Reasignar conversation_sessions del bot
  await sb.from("conversation_sessions").update({ client_id: keepId }).eq("client_id", deleteId);

  // 4. Eliminar el cliente duplicado
  const { error: errDel } = await sb.from("clients").delete().eq("id", deleteId);
  if (errDel) throw new Error(`Error eliminando cliente: ${errDel.message}`);

  revalidatePath("/backoffice/clientes");
  revalidatePath("/backoffice/clientes/duplicados");
}

export async function createClient_(formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client.from("clients").insert({
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
    email: (formData.get("email") as string) || null,
    notes: (formData.get("notes") as string) || null,
    source: (formData.get("source") as string) || "manual",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/clientes");
  redirect("/backoffice/clientes");
}

export async function toggleClientBlocked(id: string, blocked: boolean) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("clients")
    .update({ is_blocked: blocked })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/clientes");
  revalidatePath(`/backoffice/clientes/${id}/editar`);
}

export async function updateClient_(id: string, formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("clients")
    .update({
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || null,
      notes: (formData.get("notes") as string) || null,
      source: (formData.get("source") as string) || "manual",
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/clientes");
  revalidatePath(`/backoffice/clientes/${id}`);
  redirect(`/backoffice/clientes/${id}`);
}
