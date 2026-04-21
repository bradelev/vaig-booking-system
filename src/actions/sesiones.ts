"use server";

import { revalidatePath } from "next/cache";
import { LOCAL_TIMEZONE, localInputToISO } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export async function searchClients(query: string): Promise<
  { id: string; first_name: string; last_name: string; phone: string }[]
> {
  if (query.trim().length < 2) return [];

  const supabase = await createClient();
  const client = supabase as SupabaseClient;

  const { data, error } = await client
    .from("clients")
    .select("id, first_name, last_name, phone")
    .ilike("nombre_normalizado", `%${query.toLowerCase()}%`)
    .limit(10);

  if (error) return [];
  return data ?? [];
}

export async function createSession(data: {
  client_id: string;
  fecha: string;
  tipo_servicio: string;
  descripcion?: string;
  operadora?: string;
  professional_id?: string;
  monto_lista?: number;
  descuento_pct?: number;
  monto_cobrado?: number;
  metodo_pago?: string;
  banco?: string;
  sesion_n?: number;
  sesion_total_cuponera?: number;
  notas?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const client = supabase as SupabaseClient;

  const { error } = await client.from("sesiones_historicas").insert({
    client_id: data.client_id,
    fecha: data.fecha,
    tipo_servicio: data.tipo_servicio,
    descripcion: data.descripcion || null,
    operadora: data.operadora || null,
    professional_id: data.professional_id || null,
    monto_lista: data.monto_lista ?? null,
    descuento_pct: data.descuento_pct ?? null,
    monto_cobrado: data.monto_cobrado ?? null,
    metodo_pago: data.metodo_pago || null,
    banco: data.banco || null,
    sesion_n: data.sesion_n ?? null,
    sesion_total_cuponera: data.sesion_total_cuponera ?? null,
    notas: data.notas || null,
    fuente: "backoffice",
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/backoffice/sesiones");
  return { success: true };
}

export async function confirmBookingAsSession(
  bookingId: string,
  overrides: {
    client_id?: string;
    fecha?: string;
    hora?: string; // HH:MM
    operadora?: string;
    professional_id?: string;
    tipo_servicio?: string;
    descripcion?: string;
    monto_lista?: number;
    monto_cobrado?: number;
    descuento_pct?: number;
    metodo_pago?: string;
    banco?: string;
    sesion_n?: number;
    sesion_total_cuponera?: number;
    notas?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const client = supabase as SupabaseClient;

  // Fetch booking details to pre-fill session
  const { data: booking, error: fetchError } = await client
    .from("bookings")
    .select(
      `id, scheduled_at, client_id, professional_id, client_package_id,
       clients(first_name, last_name),
       services(name, category, price),
       professionals(name)`
    )
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { success: false, error: fetchError?.message ?? "Booking no encontrado" };
  }

  const fecha = overrides.fecha ?? new Date(booking.scheduled_at).toLocaleDateString("sv-SE", {
    timeZone: LOCAL_TIMEZONE,
  });
  const tipoServicio = overrides.tipo_servicio ?? booking.services?.category ?? booking.services?.name ?? "Servicio";

  // Auto-populate sesion_n/sesion_total from client_packages if package present and overrides not provided
  let sesionN = overrides.sesion_n ?? null;
  let sesionTotal = overrides.sesion_total_cuponera ?? null;
  if (booking.client_package_id && (sesionN == null || sesionTotal == null)) {
    const { data: cp } = await client
      .from("client_packages")
      .select("sessions_used, packages(sessions_count)")
      .eq("id", booking.client_package_id)
      .single();
    if (cp) {
      if (sesionN == null) sesionN = (cp.sessions_used ?? 0) + 1;
      if (sesionTotal == null) sesionTotal = cp.packages?.sessions_count ?? null;
    }
  }

  // Build scheduled_at if hora provided (update booking time too)
  let newScheduledAt: string | null = null;
  if (overrides.fecha || overrides.hora) {
    const baseFecha = overrides.fecha ?? fecha;
    const baseHora = overrides.hora ?? new Date(booking.scheduled_at)
      .toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: LOCAL_TIMEZONE, hour12: false });
    // Build as ART datetime → store as UTC
    newScheduledAt = localInputToISO(`${baseFecha}T${baseHora}`);
  }

  const effectiveClientId = overrides.client_id ?? booking.client_id;

  // Insert sesion_historica linked to this booking
  const { error: insertError } = await client.from("sesiones_historicas").insert({
    client_id: effectiveClientId,
    fecha,
    tipo_servicio: tipoServicio,
    descripcion: overrides.descripcion ?? booking.services?.name ?? null,
    operadora: overrides.operadora ?? booking.professionals?.name ?? null,
    professional_id: overrides.professional_id ?? booking.professional_id ?? null,
    booking_id: bookingId,
    monto_lista: overrides.monto_lista ?? booking.services?.price ?? null,
    client_package_id: booking.client_package_id ?? null,
    monto_cobrado: overrides.monto_cobrado ?? null,
    descuento_pct: overrides.descuento_pct ?? null,
    metodo_pago: overrides.metodo_pago ?? null,
    banco: overrides.banco ?? null,
    sesion_n: sesionN,
    sesion_total_cuponera: sesionTotal,
    notas: overrides.notas ?? null,
    fuente: "backoffice",
  });

  if (insertError) return { success: false, error: insertError.message };

  // Update booking: status + optionally client_id / scheduled_at
  const bookingUpdate: Record<string, unknown> = { status: "realized" };
  if (overrides.client_id && overrides.client_id !== booking.client_id) {
    bookingUpdate.client_id = overrides.client_id;
  }
  if (newScheduledAt) {
    bookingUpdate.scheduled_at = newScheduledAt;
  }

  const { error: updateError } = await client
    .from("bookings")
    .update(bookingUpdate)
    .eq("id", bookingId);

  if (updateError) return { success: false, error: updateError.message };

  // Increment sessions_used on associated pack if any
  if (booking.client_package_id) {
    const { data: cp } = await client
      .from("client_packages")
      .select("sessions_used, sessions_total")
      .eq("id", booking.client_package_id)
      .single();

    if (cp) {
      if (cp.sessions_used >= cp.sessions_total) {
        logger.warn("sessions_used at cap, skipping increment", {
          client_package_id: booking.client_package_id,
          sessions_used: cp.sessions_used,
          sessions_total: cp.sessions_total,
        });
      } else {
        await client
          .from("client_packages")
          .update({ sessions_used: cp.sessions_used + 1 })
          .eq("id", booking.client_package_id);
      }
    }
  }

  revalidatePath("/backoffice/sesiones");
  revalidatePath("/backoffice/citas");
  return { success: true };
}

export async function updateSession(
  sessionId: string,
  data: {
    client_id?: string | null;
    fecha?: string | null;
    tipo_servicio?: string;
    descripcion?: string | null;
    operadora?: string | null;
    professional_id?: string | null;
    monto_lista?: number | null;
    descuento_pct?: number | null;
    monto_cobrado?: number | null;
    metodo_pago?: string | null;
    banco?: string | null;
    sesion_n?: number | null;
    sesion_total_cuponera?: number | null;
    notas?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const client = supabase as SupabaseClient;

  const { error } = await client
    .from("sesiones_historicas")
    .update(data)
    .eq("id", sessionId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/backoffice/sesiones");
  return { success: true };
}

export async function deleteSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const client = supabase as SupabaseClient;

  const { error } = await client
    .from("sesiones_historicas")
    .delete()
    .eq("id", sessionId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/backoffice/sesiones");
  return { success: true };
}

export async function quickCreateClientForSession(data: {
  first_name: string;
  last_name: string;
  phone: string;
  instagram?: string;
  source?: string;
  referido_por?: string;
}): Promise<{ id: string; first_name: string; last_name: string } | { error: string }> {
  const supabase = await createClient();
  const client = supabase as SupabaseClient;

  const { data: row, error } = await client
    .from("clients")
    .insert({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      phone: data.phone.trim(),
      instagram: data.instagram?.trim() || null,
      source: data.source || null,
      referido_por: data.referido_por || null,
      es_historico: false,
    })
    .select("id, first_name, last_name")
    .single();

  if (error) return { error: error.message };
  return { id: row.id, first_name: row.first_name, last_name: row.last_name };
}
