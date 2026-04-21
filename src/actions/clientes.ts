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

  // Fetch all clients with session count from the view
  const { data: rawClientes } = await supabase
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

  // Pre-compute normalized names
  const entries = clientes.map((c, idx) => ({
    idx,
    client: c,
    norm: norm(`${c.first_name} ${c.last_name}`),
  })).filter((e) => e.norm.split(" ").length >= 2);

  const pairs: ParDuplicado[] = [];
  const seen = new Set<string>();

  // Phase 1: Exact nombre_normalizado matches (O(n) via Map grouping)
  const normGroups = new Map<string, typeof entries>();
  for (const e of entries) {
    const group = normGroups.get(e.norm);
    if (group) group.push(e);
    else normGroups.set(e.norm, [e]);
  }
  for (const group of normGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = [group[i].client.id, group[j].client.id].sort().join("|");
        seen.add(key);
        pairs.push({ a: group[i].client, b: group[j].client, distancia: 0 });
      }
    }
  }

  // Phase 2: Fuzzy matches (Levenshtein 1-2) — block by first name to avoid O(n²)
  // Only compare clients that share the same first name (or first name within edit distance 1)
  const firstNameGroups = new Map<string, typeof entries>();
  for (const e of entries) {
    const firstName = e.norm.split(" ")[0];
    const group = firstNameGroups.get(firstName);
    if (group) group.push(e);
    else firstNameGroups.set(firstName, [e]);
  }

  // Compare within same first-name blocks and across blocks with similar first names
  const firstNames = Array.from(firstNameGroups.keys());
  for (let fi = 0; fi < firstNames.length; fi++) {
    const blockA = firstNameGroups.get(firstNames[fi])!;

    // Within same block
    for (let i = 0; i < blockA.length; i++) {
      for (let j = i + 1; j < blockA.length; j++) {
        const key = [blockA[i].client.id, blockA[j].client.id].sort().join("|");
        if (seen.has(key)) continue;
        const dist = levenshtein(blockA[i].norm, blockA[j].norm);
        if (dist >= 1 && dist <= 2) {
          seen.add(key);
          pairs.push({ a: blockA[i].client, b: blockA[j].client, distancia: dist });
        }
      }
    }

    // Cross-block: only if first names are within edit distance 1
    for (let fj = fi + 1; fj < firstNames.length; fj++) {
      if (levenshtein(firstNames[fi], firstNames[fj]) > 1) continue;
      const blockB = firstNameGroups.get(firstNames[fj])!;
      for (const ea of blockA) {
        for (const eb of blockB) {
          const key = [ea.client.id, eb.client.id].sort().join("|");
          if (seen.has(key)) continue;
          const dist = levenshtein(ea.norm, eb.norm);
          if (dist >= 1 && dist <= 2) {
            seen.add(key);
            pairs.push({ a: ea.client, b: eb.client, distancia: dist });
          }
        }
      }
    }
  }

  // Sort: exact matches first, then by distance
  pairs.sort((x, y) => x.distancia - y.distancia);
  return pairs;
}

export async function mergeClients(keepId: string, deleteId: string): Promise<void> {
  if (!keepId || !deleteId || keepId === deleteId) {
    throw new Error("IDs inválidos para fusión");
  }

  const supabase = await createClient();

  type SesionRow = { id: string; fecha: string; tipo_servicio: string; descripcion: string | null };

  // 1. Reasignar sesiones_historicas — ignorar conflictos de unicidad (ON CONFLICT DO NOTHING via upsert skip)
  const { data: rawSesiones } = await supabase
    .from("sesiones_historicas")
    .select("id, fecha, tipo_servicio, descripcion")
    .eq("client_id", deleteId);
  const sesiones = (rawSesiones ?? []) as SesionRow[];

  if (sesiones.length > 0) {
    // Get existing sessions for keepId to avoid duplicates
    const { data: rawExistentes } = await supabase
      .from("sesiones_historicas")
      .select("fecha, tipo_servicio, descripcion")
      .eq("client_id", keepId);
    const existentes = (rawExistentes ?? []) as Pick<SesionRow, "fecha" | "tipo_servicio" | "descripcion">[];

    const existenteSet = new Set(
      existentes.map(
        (s) => `${s.fecha}|${s.tipo_servicio}|${s.descripcion ?? ""}`
      )
    );

    const idsAMover = sesiones
      .filter((s) => !existenteSet.has(`${s.fecha}|${s.tipo_servicio}|${s.descripcion ?? ""}`))
      .map((s) => s.id);

    if (idsAMover.length > 0) {
      const { error: errSes } = await supabase
        .from("sesiones_historicas")
        .update({ client_id: keepId })
        .in("id", idsAMover);
      if (errSes) throw new Error(`Error reasignando sesiones: ${errSes.message}`);
    }
  }

  // 2. Reasignar client_packages (ON DELETE RESTRICT — debe moverse antes de borrar)
  const { error: errPkg } = await supabase
    .from("client_packages")
    .update({ client_id: keepId })
    .eq("client_id", deleteId);
  if (errPkg) throw new Error(`Error reasignando paquetes: ${errPkg.message}`);

  // 3. Reasignar bookings
  const { error: errBook } = await supabase
    .from("bookings")
    .update({ client_id: keepId })
    .eq("client_id", deleteId);
  if (errBook) throw new Error(`Error reasignando bookings: ${errBook.message}`);

  // 4. Reasignar conversation_sessions del bot
  const { error: errSess } = await supabase
    .from("conversation_sessions")
    .update({ client_id: keepId })
    .eq("client_id", deleteId);
  if (errSess) throw new Error(`Error reasignando sesiones bot: ${errSess.message}`);

  // 5. Eliminar el cliente duplicado
  const { error: errDel } = await supabase.from("clients").delete().eq("id", deleteId);
  if (errDel) throw new Error(`Error eliminando cliente: ${errDel.message}`);

  revalidatePath("/backoffice/clientes");
  revalidatePath("/backoffice/clientes/duplicados");
}

export async function createClient_(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("clients").insert({
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

  const { error } = await supabase
    .from("clients")
    .update({ is_blocked: blocked })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/clientes");
  revalidatePath(`/backoffice/clientes/${id}/editar`);
}

export async function updateClient_(id: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
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
