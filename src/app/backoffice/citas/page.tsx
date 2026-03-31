import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import CitasPageClient from "./citas-page-client";

export const metadata: Metadata = { title: "Citas" };

interface PageProps {
  searchParams: Promise<{ semana?: string }>;
}

function todayAR(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
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

export type BookingItem = {
  id: string;
  scheduledAt: string;
  status: string;
  notes: string | null;
  gcalEventId: string | null;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  professionalId: string | null;
  professionalName: string | null;
};

export default async function CitasPage({ searchParams }: PageProps) {
  const { semana: semanaParam } = await searchParams;
  const today = todayAR();
  const baseDate = semanaParam && isValidDate(semanaParam) ? semanaParam : today;
  const weekMonday = getMondayOfWeek(baseDate);
  const weekDates: string[] = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));
  const weekEnd = addDays(weekMonday, 7);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [bookingsResult, clientsResult, servicesResult, professionalsResult] = await Promise.all([
    client
      .from("bookings")
      .select(
        `id, scheduled_at, status, notes, gcal_event_id,
         clients(id, first_name, last_name, phone),
         services(id, name),
         professionals(id, name)`
      )
      .gte("scheduled_at", `${weekMonday}T00:00:00`)
      .lt("scheduled_at", `${weekEnd}T00:00:00`)
      .order("scheduled_at"),
    client.from("clients").select("id, first_name, last_name").order("last_name"),
    client.from("services").select("id, name").eq("is_active", true).order("name"),
    client.from("professionals").select("id, name").eq("is_active", true).order("name"),
  ]);

  type RawBooking = {
    id: string;
    scheduled_at: string;
    status: string;
    notes: string | null;
    gcal_event_id: string | null;
    clients: { id: string; first_name: string; last_name: string; phone: string } | null;
    services: { id: string; name: string } | null;
    professionals: { id: string; name: string } | null;
  };

  const allBookings = (bookingsResult.data ?? []) as RawBooking[];

  const bookingsByDate: Record<string, BookingItem[]> = {};
  for (const b of allBookings) {
    const dateKey = new Date(b.scheduled_at).toLocaleDateString("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    if (!bookingsByDate[dateKey]) bookingsByDate[dateKey] = [];
    bookingsByDate[dateKey].push({
      id: b.id,
      scheduledAt: b.scheduled_at,
      status: b.status,
      notes: b.notes,
      gcalEventId: b.gcal_event_id,
      clientId: b.clients?.id ?? "",
      clientName: b.clients
        ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
        : "—",
      clientPhone: b.clients?.phone ?? "",
      serviceId: b.services?.id ?? "",
      serviceName: b.services?.name ?? "—",
      professionalId: b.professionals?.id ?? null,
      professionalName: b.professionals?.name ?? null,
    });
  }

  return (
    <CitasPageClient
      weekDates={weekDates}
      bookingsByDate={bookingsByDate}
      allClients={(clientsResult.data ?? []).map(
        (c: { id: string; first_name: string; last_name: string }) => ({
          id: c.id,
          label: `${c.first_name} ${c.last_name}`.trim(),
        })
      )}
      allServices={(servicesResult.data ?? []).map(
        (s: { id: string; name: string }) => ({ id: s.id, label: s.name })
      )}
      allProfessionals={(professionalsResult.data ?? []).map(
        (p: { id: string; name: string }) => ({ id: p.id, label: p.name })
      )}
    />
  );
}
