import type { Metadata } from "next";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import SessionsPageClient from "./page-client";

export const metadata: Metadata = { title: "Sesiones" };

interface PageProps {
  searchParams: Promise<{ semana?: string }>;
}

function todayAR(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: LOCAL_TIMEZONE });
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T12:00:00"));
}

export default async function SesionesPage({ searchParams }: PageProps) {
  const { semana: semanaParam } = await searchParams;

  const today = todayAR();
  const baseDate = semanaParam && isValidDate(semanaParam) ? semanaParam : today;
  const weekMonday = getMondayOfWeek(baseDate);
  const weekDates: string[] = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));
  const weekEnd = addDays(weekMonday, 7);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: professionals } = await client
    .from("professionals")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: servicesRaw } = await client
    .from("services")
    .select("id, name, category, price")
    .eq("is_active", true)
    .order("name");

  const FALLBACK_CATEGORIES = [
    "Masajes",
    "Facial",
    "Cejas y Pestañas",
    "Manos y Pies",
    "Depilación Láser",
    "Day Spa",
    "Aparatología / HIFU",
    "Combos",
    "Otros",
  ];

  const { data: servicesData } = await client
    .from("services")
    .select("category")
    .not("category", "is", null)
    .order("category");

  const dbCategories: string[] = Array.from(
    new Set(
      (servicesData ?? [])
        .map((s: { category: string }) => s.category)
        .filter(Boolean)
    )
  );
  const categories = dbCategories.length > 0 ? dbCategories : FALLBACK_CATEGORIES;

  const { data: bookingsRaw } = await client
    .from("bookings")
    .select(
      `id, scheduled_at, status,
       clients(id, first_name, last_name, source),
       services(name, category),
       professionals(id, name)`
    )
    .gte("scheduled_at", `${weekMonday}T00:00:00`)
    .lt("scheduled_at", `${weekEnd}T00:00:00`)
    .in("status", ["confirmed", "deposit_paid", "realized"])
    .order("scheduled_at");

  const { data: sesionesRaw } = await client
    .from("sesiones_historicas")
    .select(
      `id, fecha, tipo_servicio, descripcion, operadora, monto_cobrado, metodo_pago, fuente,
       monto_lista, descuento_pct, banco, sesion_n, sesion_total_cuponera, notas, professional_id,
       clients(id, first_name, last_name, source),
       booking_id`
    )
    .gte("fecha", weekMonday)
    .lte("fecha", weekDates[6])
    .order("created_at");

  type RawBooking = {
    id: string;
    scheduled_at: string;
    status: string;
    clients: { id: string; first_name: string; last_name: string; source: string | null } | null;
    services: { name: string; category: string | null } | null;
    professionals: { id: string; name: string } | null;
  };

  type RawSesion = {
    id: string;
    fecha: string;
    tipo_servicio: string;
    descripcion: string | null;
    operadora: string | null;
    monto_cobrado: number | null;
    metodo_pago: string | null;
    fuente: string;
    monto_lista: number | null;
    descuento_pct: number | null;
    banco: string | null;
    sesion_n: number | null;
    sesion_total_cuponera: number | null;
    notas: string | null;
    professional_id: string | null;
    clients: { id: string; first_name: string; last_name: string; source: string | null } | null;
    booking_id: string | null;
  };

  const allBookings = (bookingsRaw ?? []) as RawBooking[];
  const allSesiones = (sesionesRaw ?? []) as RawSesion[];

  const confirmedBookingIdsByDate: Record<string, Set<string>> = {};
  for (const s of allSesiones) {
    if (!s.booking_id) continue;
    if (!confirmedBookingIdsByDate[s.fecha]) {
      confirmedBookingIdsByDate[s.fecha] = new Set();
    }
    confirmedBookingIdsByDate[s.fecha].add(s.booking_id);
  }

  const bookingsByDate: Record<
    string,
    Array<{
      id: string;
      scheduledAt: string;
      status: string;
      clientId?: string;
      clientName: string;
      serviceName: string;
      serviceCategory: string;
      professionalName?: string;
      professionalId?: string;
      clientSource?: string;
      alreadyConfirmed: boolean;
    }>
  > = {};

  for (const b of allBookings) {
    const dateKey = new Date(b.scheduled_at).toLocaleDateString("sv-SE", {
      timeZone: LOCAL_TIMEZONE,
    });
    if (!bookingsByDate[dateKey]) bookingsByDate[dateKey] = [];
    bookingsByDate[dateKey].push({
      id: b.id,
      scheduledAt: b.scheduled_at,
      status: b.status,
      clientId: b.clients?.id,
      clientName: b.clients ? `${b.clients.first_name} ${b.clients.last_name}` : "—",
      serviceName: b.services?.name ?? "—",
      serviceCategory: b.services?.category ?? b.services?.name ?? "Servicio",
      professionalName: b.professionals?.name,
      professionalId: b.professionals?.id,
      clientSource: b.clients?.source ?? undefined,
      alreadyConfirmed: !!(confirmedBookingIdsByDate[dateKey]?.has(b.id)),
    });
  }

  const sesionesByDate: Record<
    string,
    Array<{
      id: string;
      tipoServicio: string;
      descripcion?: string;
      operadora?: string;
      montoCobrado?: number;
      metodoPago?: string;
      fuente: string;
      montoLista?: number;
      descuentoPct?: number;
      banco?: string;
      sesionN?: number;
      sesionTotal?: number;
      notas?: string;
      professionalId?: string;
      clientName: string;
      clientSource?: string;
    }>
  > = {};

  for (const s of allSesiones) {
    if (!sesionesByDate[s.fecha]) sesionesByDate[s.fecha] = [];
    sesionesByDate[s.fecha].push({
      id: s.id,
      tipoServicio: s.tipo_servicio,
      descripcion: s.descripcion ?? undefined,
      operadora: s.operadora ?? undefined,
      montoCobrado: s.monto_cobrado ?? undefined,
      metodoPago: s.metodo_pago ?? undefined,
      fuente: s.fuente,
      montoLista: s.monto_lista ?? undefined,
      descuentoPct: s.descuento_pct ?? undefined,
      banco: s.banco ?? undefined,
      sesionN: s.sesion_n ?? undefined,
      sesionTotal: s.sesion_total_cuponera ?? undefined,
      notas: s.notas ?? undefined,
      professionalId: s.professional_id ?? undefined,
      clientName: s.clients ? `${s.clients.first_name} ${s.clients.last_name}` : "—",
      clientSource: s.clients?.source ?? undefined,
    });
  }

  type RawService = { id: string; name: string; category: string | null; price: number };
  const services = (servicesRaw ?? []) as RawService[];

  return (
    <SessionsPageClient
      professionals={professionals ?? []}
      serviceCategories={categories}
      services={services}
      weekDates={weekDates}
      bookingsByDate={bookingsByDate}
      sesionesByDate={sesionesByDate}
    />
  );
}
