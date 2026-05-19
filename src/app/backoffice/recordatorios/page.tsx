import type { Metadata } from "next";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import { relativeDayLabel } from "@/lib/reminders/relative-label";
import RecordatoriosPageClient from "./recordatorios-page-client";

export const metadata: Metadata = { title: "Recordatorios" };

export type ReminderBooking = {
  id: string;
  scheduledAt: string;
  clientId: string;
  clientName: string;
  clientFirstName: string;
  clientPhone: string;
  serviceName: string;
  serviceCategory: string | null;
  professionalName: string | null;
  confirmationSentAt: string | null;
  clientConfirmedAt: string | null;
};

export type DayGroup = {
  dateStr: string;
  /** "Hoy", "Mañana", "Sábado 24/05" */
  label: string;
  bookings: ReminderBooking[];
};

export default async function RecordatoriosPage() {
  const now = new Date();

  // Rolling 7-day window in local timezone
  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: LOCAL_TIMEZONE });
  const sevenDaysLater = new Date(now.getTime() + 7 * 86_400_000);
  const endStr = sevenDaysLater.toLocaleDateString("sv-SE", { timeZone: LOCAL_TIMEZONE });

  const supabase = await createClient();

  const { data: rawBookings, error } = await supabase
    .from("bookings")
    .select(
      `id, scheduled_at, confirmation_sent_at, client_confirmed_at,
       clients(id, first_name, last_name, phone),
       services(name, category),
       professionals(name)`
    )
    .in("status", ["confirmed", "deposit_paid", "pending"])
    .gte("scheduled_at", `${todayStr}T00:00:00`)
    .lt("scheduled_at", `${endStr}T00:00:00`)
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
    services: { name: string; category: string | null } | null;
    professionals: { name: string } | null;
  };

  const bookings: ReminderBooking[] = ((rawBookings ?? []) as unknown as RawBooking[]).map((b) => ({
    id: b.id,
    scheduledAt: b.scheduled_at,
    clientId: b.clients?.id ?? "",
    clientName: b.clients
      ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
      : "—",
    clientFirstName: b.clients?.first_name ?? "Cliente",
    clientPhone: b.clients?.phone ?? "",
    serviceName: b.services?.name ?? "—",
    serviceCategory: b.services?.category ?? null,
    professionalName: b.professionals?.name ?? null,
    confirmationSentAt: b.confirmation_sent_at,
    clientConfirmedAt: b.client_confirmed_at,
  }));

  // Group bookings by local calendar day
  const dayMap = new Map<string, ReminderBooking[]>();
  for (const booking of bookings) {
    const dayStr = new Date(booking.scheduledAt).toLocaleDateString("sv-SE", {
      timeZone: LOCAL_TIMEZONE,
    });
    if (!dayMap.has(dayStr)) dayMap.set(dayStr, []);
    dayMap.get(dayStr)!.push(booking);
  }

  // Build ordered DayGroup array (only days that have bookings)
  const dayGroups: DayGroup[] = [];
  const sortedDays = Array.from(dayMap.keys()).sort();
  for (const dateStr of sortedDays) {
    const representativeBooking = dayMap.get(dateStr)![0];
    const { label } = relativeDayLabel(representativeBooking.scheduledAt, LOCAL_TIMEZONE, now);
    dayGroups.push({
      dateStr,
      label,
      bookings: dayMap.get(dateStr)!,
    });
  }

  const contactPhone = process.env.VAIG_CONTACT_PHONE ?? "";
  const address = process.env.VAIG_ADDRESS ?? "";
  const accessInstructions = process.env.VAIG_ACCESS_INSTRUCTIONS ?? "";

  return (
    <RecordatoriosPageClient
      dayGroups={dayGroups}
      contactPhone={contactPhone}
      address={address}
      accessInstructions={accessInstructions}
    />
  );
}
