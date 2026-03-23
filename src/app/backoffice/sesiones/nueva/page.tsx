import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SessionsPageClient from "./page-client";

export const metadata: Metadata = { title: "Sesiones" };

interface PageProps {
  searchParams: Promise<{ fecha?: string }>;
}

function todayAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export default async function SesionesNuevaPage({ searchParams }: PageProps) {
  const { fecha: fechaParam } = await searchParams;
  const fecha = fechaParam ?? todayAR();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Load professionals (active)
  const { data: professionals } = await client
    .from("professionals")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  // Load service categories
  const { data: servicesData } = await client
    .from("services")
    .select("category")
    .not("category", "is", null)
    .order("category");

  const categories: string[] = Array.from(
    new Set((servicesData ?? []).map((s: { category: string }) => s.category).filter(Boolean))
  );

  // Load bookings for the day (confirmed, deposit_paid, realized)
  const { data: bookings } = await client
    .from("bookings")
    .select(
      `id, scheduled_at, status,
       clients(id, first_name, last_name, source),
       services(name, category),
       professionals(id, name)`
    )
    .gte("scheduled_at", `${fecha}T00:00:00`)
    .lte("scheduled_at", `${fecha}T23:59:59`)
    .in("status", ["confirmed", "deposit_paid", "realized"])
    .order("scheduled_at");

  // Load sesiones_historicas for the day
  const { data: sesiones } = await client
    .from("sesiones_historicas")
    .select(
      `id, fecha, tipo_servicio, descripcion, operadora, monto_cobrado, metodo_pago, fuente,
       clients(id, first_name, last_name, source),
       booking_id`
    )
    .eq("fecha", fecha)
    .order("created_at");

  // Set of booking_ids already confirmed as session (to avoid showing them as pending)
  const confirmedBookingIds = new Set(
    (sesiones ?? [])
      .filter((s: { booking_id: string | null }) => s.booking_id)
      .map((s: { booking_id: string }) => s.booking_id)
  );

  return (
    <SessionsPageClient
      professionals={professionals ?? []}
      serviceCategories={categories}
      initialDate={fecha}
      bookings={(bookings ?? []).map((b: {
        id: string;
        scheduled_at: string;
        status: string;
        clients: { id: string; first_name: string; last_name: string; source: string | null } | null;
        services: { name: string; category: string | null } | null;
        professionals: { id: string; name: string } | null;
      }) => ({
        id: b.id,
        scheduledAt: b.scheduled_at,
        status: b.status,
        clientName: b.clients ? `${b.clients.first_name} ${b.clients.last_name}` : "—",
        serviceName: b.services?.name ?? "—",
        serviceCategory: b.services?.category ?? b.services?.name ?? "Servicio",
        professionalName: b.professionals?.name,
        professionalId: b.professionals?.id,
        clientSource: b.clients?.source ?? undefined,
        alreadyConfirmed: confirmedBookingIds.has(b.id),
      }))}
      sesiones={(sesiones ?? []).map((s: {
        id: string;
        tipo_servicio: string;
        descripcion: string | null;
        operadora: string | null;
        monto_cobrado: number | null;
        metodo_pago: string | null;
        fuente: string;
        clients: { id: string; first_name: string; last_name: string; source: string | null } | null;
      }) => ({
        id: s.id,
        tipoServicio: s.tipo_servicio,
        descripcion: s.descripcion ?? undefined,
        operadora: s.operadora ?? undefined,
        montoCobrado: s.monto_cobrado ?? undefined,
        metodoPago: s.metodo_pago ?? undefined,
        fuente: s.fuente,
        clientName: s.clients ? `${s.clients.first_name} ${s.clients.last_name}` : "—",
        clientSource: s.clients?.source ?? undefined,
      }))}
    />
  );
}
