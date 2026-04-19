import type { Metadata } from "next";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import RecordatoriosPageClient from "./recordatorios-page-client";

export const metadata: Metadata = { title: "Recordatorios" };

function tomorrowAR(): { dateStr: string; label: string } {
  const now = new Date();
  const todayStr = now.toLocaleDateString("sv-SE", {
    timeZone: LOCAL_TIMEZONE,
  });
  const tomorrow = new Date(todayStr + "T12:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toLocaleDateString("sv-SE", {
    timeZone: LOCAL_TIMEZONE,
  });
  const label = tomorrow.toLocaleDateString("es-AR", {
    timeZone: LOCAL_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return { dateStr, label };
}

export type ReminderBooking = {
  id: string;
  scheduledAt: string;
  clientId: string;
  clientName: string;
  clientFirstName: string;
  clientPhone: string;
  serviceName: string;
  professionalName: string | null;
  confirmationSentAt: string | null;
  clientConfirmedAt: string | null;
};

export default async function RecordatoriosPage() {
  const { dateStr, label } = tomorrowAR();
  const nextDateStr = (() => {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("sv-SE", {
      timeZone: LOCAL_TIMEZONE,
    });
  })();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: rawBookings, error } = await client
    .from("bookings")
    .select(
      `id, scheduled_at, confirmation_sent_at, client_confirmed_at,
       clients(id, first_name, last_name, phone),
       services(name),
       professionals(name)`
    )
    .in("status", ["confirmed", "deposit_paid", "pending"])
    .gte("scheduled_at", `${dateStr}T00:00:00`)
    .lt("scheduled_at", `${nextDateStr}T00:00:00`)
    .order("scheduled_at");

  if (error) {
    console.error("[Recordatorios] Error fetching bookings:", error);
  }

  type RawBooking = {
    id: string;
    scheduled_at: string;
    confirmation_sent_at: string | null;
    client_confirmed_at: string | null;
    clients: { id: string; first_name: string; last_name: string; phone: string } | null;
    services: { name: string } | null;
    professionals: { name: string } | null;
  };

  const bookings: ReminderBooking[] = ((rawBookings ?? []) as RawBooking[]).map((b) => ({
    id: b.id,
    scheduledAt: b.scheduled_at,
    clientId: b.clients?.id ?? "",
    clientName: b.clients
      ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
      : "—",
    clientFirstName: b.clients?.first_name ?? "Cliente",
    clientPhone: b.clients?.phone ?? "",
    serviceName: b.services?.name ?? "—",
    professionalName: b.professionals?.name ?? null,
    confirmationSentAt: b.confirmation_sent_at,
    clientConfirmedAt: b.client_confirmed_at,
  }));

  return (
    <RecordatoriosPageClient bookings={bookings} tomorrowLabel={label} />
  );
}
