import { createClient } from "@/lib/supabase/server";
import { listCalendarEvents } from "@/lib/gcal";
import type { CalendarEvent } from "@/lib/gcal";
import CalendarShell from "@/components/backoffice/agenda/calendar-shell";
import {
  AgendaEvent,
  CalendarView,
  getMondayOfWeek,
} from "@/components/backoffice/agenda/agenda-types";

interface AgendaBooking {
  id: string;
  scheduled_at: string;
  end_at?: string;
  gcal_event_id?: string;
  status: string;
  notes?: string;
  client_id?: string;
  service_id?: string;
  professional_id?: string;
  clients: { first_name: string; last_name: string } | null;
  services: { name: string; duration_minutes: number } | null;
  professionals: { id: string; name: string } | null;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; profesional?: string; vista?: string }>;
}) {
  const { semana, profesional: filterProfId, vista } = await searchParams;

  const weekParam = semana ?? new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
  const monday = getMondayOfWeek(weekParam);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [
    { data: bookingsRaw },
    { data: profsRaw },
    { data: clientsRaw },
    { data: servicesRaw },
    gcalEvents,
  ] = await Promise.all([
    client
      .from("bookings")
      .select(
        `id, scheduled_at, end_at, gcal_event_id, status, notes, client_id, service_id, professional_id,
         clients(first_name, last_name),
         services(name, duration_minutes),
         professionals(id, name)`
      )
      .gte("scheduled_at", monday.toISOString())
      .lte("scheduled_at", sunday.toISOString())
      .not("status", "in", '("cancelled","no_show")')
      .order("scheduled_at"),
    client.from("professionals").select("id, name").eq("is_active", true).order("name"),
    client.from("clients").select("id, first_name, last_name").order("first_name"),
    client.from("services").select("id, name, duration_minutes").eq("is_active", true).order("name"),
    listCalendarEvents(monday.toISOString(), sunday.toISOString()),
  ]);

  const allBookings = (bookingsRaw ?? []) as AgendaBooking[];
  const professionals = (profsRaw ?? []) as { id: string; name: string }[];
  const clients = (clientsRaw ?? []) as { id: string; first_name: string; last_name: string }[];
  const services = (servicesRaw ?? []) as { id: string; name: string; duration_minutes: number }[];
  const calEvents = gcalEvents as CalendarEvent[];

  // Build set of gcal_event_ids already linked to a local booking
  const linkedGcalIds = new Set(
    allBookings.map((b) => b.gcal_event_id).filter(Boolean)
  );

  // Convert bookings to AgendaEvent
  const bookingEvents: AgendaEvent[] = allBookings.map((b) => ({
    id: b.id,
    scheduled_at: b.scheduled_at,
    end_at: b.end_at ?? b.scheduled_at,
    status: b.status,
    source: "booking",
    clientName: b.clients
      ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
      : "—",
    serviceName: b.services?.name ?? "—",
    professionalName: b.professionals?.name,
    client_id: b.client_id,
    service_id: b.service_id,
    professional_id: b.professional_id,
    notes: b.notes,
  }));

  // Convert GCal events (skip ones already linked to a booking)
  const gcalAgendaEvents: AgendaEvent[] = calEvents
    .filter((e) => !linkedGcalIds.has(e.id))
    .map((e) => ({
      id: e.id,
      scheduled_at: e.start,
      end_at: e.end,
      status: "confirmed",
      source: "gcal",
      clientName: e.summary,
      serviceName: "",
      gcalColorId: e.colorId,
    }));

  // Merge and sort
  const allEvents: AgendaEvent[] = [...bookingEvents, ...gcalAgendaEvents].sort(
    (a, b) => a.scheduled_at.localeCompare(b.scheduled_at)
  );

  const initialView: CalendarView =
    vista === "day" || vista === "month" || vista === "4days" ? (vista as CalendarView) : "week";

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-0">
      <CalendarShell
        events={allEvents}
        professionals={professionals}
        clients={clients}
        services={services}
        initialWeek={weekParam}
        initialView={initialView}
        initialProfId={filterProfId}
      />
    </div>
  );
}
