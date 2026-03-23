"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    operadora?: string;
    professional_id?: string;
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
       services(name, category),
       professionals(name)`
    )
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { success: false, error: fetchError?.message ?? "Booking no encontrado" };
  }

  const fecha = new Date(booking.scheduled_at).toISOString().split("T")[0];
  const tipoServicio = booking.services?.category ?? booking.services?.name ?? "Servicio";

  // Insert sesion_historica linked to this booking
  const { error: insertError } = await client.from("sesiones_historicas").insert({
    client_id: booking.client_id,
    fecha,
    tipo_servicio: tipoServicio,
    descripcion: booking.services?.name ?? null,
    operadora: overrides.operadora ?? booking.professionals?.name ?? null,
    professional_id: overrides.professional_id ?? booking.professional_id ?? null,
    booking_id: bookingId,
    monto_cobrado: overrides.monto_cobrado ?? null,
    descuento_pct: overrides.descuento_pct ?? null,
    metodo_pago: overrides.metodo_pago ?? null,
    banco: overrides.banco ?? null,
    sesion_n: overrides.sesion_n ?? null,
    sesion_total_cuponera: overrides.sesion_total_cuponera ?? null,
    notas: overrides.notas ?? null,
    fuente: "backoffice",
  });

  if (insertError) return { success: false, error: insertError.message };

  // Mark booking as realized
  const { error: updateError } = await client
    .from("bookings")
    .update({ status: "realized" })
    .eq("id", bookingId);

  if (updateError) return { success: false, error: updateError.message };

  // Increment sessions_used on associated pack if any
  if (booking.client_package_id) {
    const { data: cp } = await client
      .from("client_packages")
      .select("sessions_used")
      .eq("id", booking.client_package_id)
      .single();

    if (cp) {
      await client
        .from("client_packages")
        .update({ sessions_used: cp.sessions_used + 1 })
        .eq("id", booking.client_package_id);
    }
  }

  revalidatePath("/backoffice/sesiones");
  revalidatePath("/backoffice/citas");
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
