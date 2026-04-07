import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Users, DollarSign, Plus, Eye, CreditCard } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };
import StatCard from "@/components/backoffice/stat-card";
import StatusBadge from "@/components/backoffice/status-badge";
import { formatCurrency, formatTime } from "@/lib/utils";

interface TodayBooking {
  id: string;
  scheduled_at: string;
  status: string;
  clients: { first_name: string; last_name: string } | null;
  services: { name: string } | null;
  professionals: { name: string } | null;
}

interface Payment {
  amount: number;
}


function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function BackofficePage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Yesterday range
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayEnd);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

  const [
    { count: todayCount },
    { count: clientsCount },
    { data: todayBookingsRaw },
    { data: todayPaymentsRaw },
    { count: yesterdayCount },
    { data: yesterdayPaymentsRaw },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString()),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select(
        `id, scheduled_at, status,
         clients(first_name, last_name),
         services(name),
         professionals(name)`
      )
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
      .order("scheduled_at"),
    supabase
      .from("payments")
      .select("amount")
      .gte("created_at", todayStart.toISOString())
      .lte("created_at", todayEnd.toISOString()),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_at", yesterdayStart.toISOString())
      .lte("scheduled_at", yesterdayEnd.toISOString()),
    supabase
      .from("payments")
      .select("amount")
      .gte("created_at", yesterdayStart.toISOString())
      .lte("created_at", yesterdayEnd.toISOString()),
  ]);

  const todayBookings = (todayBookingsRaw ?? []) as unknown as TodayBooking[];
  const todayPayments = (todayPaymentsRaw ?? []) as unknown as Payment[];
  const yesterdayPayments = (yesterdayPaymentsRaw ?? []) as unknown as Payment[];

  const ingresos = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const ingresosAyer = yesterdayPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const citasTrend = calcTrend(todayCount ?? 0, yesterdayCount ?? 0);
  const ingresosTrend = calcTrend(ingresos, ingresosAyer);

  const todayFormatted = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{getGreeting()}</h1>
        <p className="text-sm text-muted-foreground capitalize">{todayFormatted}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Citas hoy" value={todayCount ?? 0} icon={CalendarDays} trend={{ value: citasTrend, label: "vs ayer" }} />
        <StatCard title="Clientes" value={clientsCount ?? 0} icon={Users} subtitle="total registrados" />
        <StatCard title="Ingresos hoy" value={formatCurrency(ingresos)} icon={DollarSign} subtitle="cobros del día" trend={{ value: ingresosTrend, label: "vs ayer" }} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/backoffice/citas/nueva"
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
        >
          <div className="rounded-lg bg-primary/10 p-2">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Nueva cita</p>
            <p className="text-xs text-muted-foreground">Agendar turno</p>
          </div>
        </Link>
        <Link
          href="/backoffice/agenda"
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
        >
          <div className="rounded-lg bg-primary/10 p-2">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Ver agenda</p>
            <p className="text-xs text-muted-foreground">Calendario semanal</p>
          </div>
        </Link>
        <Link
          href="/backoffice/pagos"
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
        >
          <div className="rounded-lg bg-primary/10 p-2">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Pagos pendientes</p>
            <p className="text-xs text-muted-foreground">Confirmar señas</p>
          </div>
        </Link>
      </div>

      {/* Today's bookings */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Citas de hoy</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                {["Hora", "Cliente", "Servicio", "Profesional", "Estado"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {todayBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No hay citas para hoy
                  </td>
                </tr>
              ) : (
                todayBookings.map((b) => (
                  <tr key={b.id} className="transition-colors duration-150 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-foreground">
                      {formatTime(b.scheduled_at)}
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {b.clients
                        ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {b.services?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {b.professionals?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
