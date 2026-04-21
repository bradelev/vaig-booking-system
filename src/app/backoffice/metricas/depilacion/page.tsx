import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getARTComponents } from "@/lib/timezone";
import { formatCurrency, formatDate } from "@/lib/utils";
import StatCard from "@/components/backoffice/stat-card";
import PeriodSelector from "./period-selector-client";
import ProfessionalChart from "./professional-chart-client";
import DemandHeatmap from "./heatmap-client";
import ReactivacionTable from "./reactivacion-table-client";

export const metadata: Metadata = { title: "Depilación — Métricas" };

const PAGE_SIZE = 25;

function getPeriodStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function DepilacionMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; page?: string }>;
}) {
  const { periodo, page } = await searchParams;
  const days = [30, 60, 90, 180].includes(Number(periodo)) ? Number(periodo) : 90;
  const currentPage = Math.max(1, Number(page) || 1);
  const periodStart = getPeriodStart(days);
  const heatmapStart = getPeriodStart(180); // always 6 months for heatmap

  const supabase = await createClient();

  // Q1: Get depilación service IDs
  const { data: depServices } = await supabase
    .from("services")
    .select("id")
    .eq("category", "Depilacion Laser");

  const serviceIds: string[] = (depServices ?? []).map((s) => (s as { id: string }).id);

  if (serviceIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Depilación</h1>
        <p className="text-sm text-gray-500">
          No se encontraron servicios de depilación configurados.
        </p>
      </div>
    );
  }

  // Parallel queries
  const [
    { data: kpiBookings },
    { data: paymentRows },
    { data: professionalRows },
    { data: heatmapBookings },
    { data: reactivacionRows },
    { data: futureBookingClients },
  ] = await Promise.all([
    // Q2: KPI bookings (period)
    supabase
      .from("bookings")
      .select("status")
      .in("service_id", serviceIds)
      .gte("scheduled_at", periodStart),

    // Q3: Ticket promedio — payments for realized depilación bookings
    supabase
      .from("payments")
      .select("amount, bookings!inner(service_id, status, scheduled_at)")
      .in("bookings.service_id", serviceIds)
      .eq("bookings.status", "realized")
      .gte("bookings.scheduled_at", periodStart),

    // Q4: Professional distribution
    supabase
      .from("bookings")
      .select("status, professionals(name)")
      .in("service_id", serviceIds)
      .gte("scheduled_at", periodStart)
      .not("professional_id", "is", null),

    // Q5: Heatmap — all non-cancelled depilación bookings last 6 months
    supabase
      .from("bookings")
      .select("scheduled_at")
      .in("service_id", serviceIds)
      .neq("status", "cancelled")
      .gte("scheduled_at", heatmapStart),

    // Q6: Reactivación — clients with realized depilación bookings
    supabase
      .from("bookings")
      .select("client_id, scheduled_at, clients!inner(id, first_name, last_name, phone)")
      .in("service_id", serviceIds)
      .eq("status", "realized")
      .order("scheduled_at", { ascending: false }),

    // Q7: Clients with future depilación bookings (to exclude from reactivation)
    supabase
      .from("bookings")
      .select("client_id")
      .in("service_id", serviceIds)
      .gt("scheduled_at", new Date().toISOString())
      .neq("status", "cancelled"),
  ]);

  // === KPIs ===
  const allKpi = (kpiBookings ?? []) as { status: string }[];
  const realizados = allKpi.filter((b) => b.status === "realized").length;
  const canceladosNoshow = allKpi.filter(
    (b) => b.status === "cancelled" || b.status === "no_show",
  ).length;
  const totalTerminados = realizados + canceladosNoshow;
  const ocupacion = totalTerminados > 0 ? Math.round((realizados / totalTerminados) * 100) : 0;

  // Ticket promedio
  const payments = (paymentRows ?? []) as { amount: number }[];
  const ticketPromedio =
    payments.length > 0
      ? payments.reduce((sum, p) => sum + Number(p.amount), 0) / payments.length
      : 0;

  // Clientes sin turno +60 días
  const futureClientIds = new Set(
    ((futureBookingClients ?? []) as { client_id: string }[]).map((b) => b.client_id),
  );
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const clientLastVisit = new Map<
    string,
    { lastVisit: Date }
  >();
  for (const row of (reactivacionRows ?? []) as unknown as {
    client_id: string;
    scheduled_at: string;
  }[]) {
    if (!clientLastVisit.has(row.client_id)) {
      clientLastVisit.set(row.client_id, { lastVisit: new Date(row.scheduled_at) });
    }
  }
  let clientesSinTurno60 = 0;
  for (const [clientId, { lastVisit }] of clientLastVisit) {
    if (!futureClientIds.has(clientId) && lastVisit < sixtyDaysAgo) {
      clientesSinTurno60++;
    }
  }

  // === Professional distribution ===
  const profMap = new Map<string, { realizados: number; cancelados: number }>();
  for (const row of (professionalRows ?? []) as unknown as {
    status: string;
    professionals: { name: string } | null;
  }[]) {
    const name = row.professionals?.name ?? "Sin asignar";
    if (!profMap.has(name)) profMap.set(name, { realizados: 0, cancelados: 0 });
    const entry = profMap.get(name)!;
    if (row.status === "realized") entry.realizados++;
    else if (row.status === "cancelled" || row.status === "no_show") entry.cancelados++;
  }
  const professionalData = Array.from(profMap.entries())
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.realizados - a.realizados);

  // === Heatmap ===
  // dayIndex: 0=Lunes..6=Domingo, slotIndex: 0=08-10, 1=10-12, ..., 5=18-20
  const heatmapGrid: number[][] = Array.from({ length: 7 }, () => Array(6).fill(0));
  let heatmapTotal = 0;
  for (const row of (heatmapBookings ?? []) as { scheduled_at: string }[]) {
    const { dayOfWeek, hour } = getARTComponents(new Date(row.scheduled_at));
    // Convert dayOfWeek (0=Sun) to our index (0=Mon)
    const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const slotIdx = Math.floor((hour - 8) / 2);
    if (slotIdx >= 0 && slotIdx < 6) {
      heatmapGrid[dayIdx][slotIdx]++;
      heatmapTotal++;
    }
  }

  // === Reactivación table ===
  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

  // Aggregate per client
  const clientAgg = new Map<
    string,
    {
      id: string;
      nombre: string;
      phone: string;
      lastVisit: Date;
      totalSesiones: number;
    }
  >();
  for (const row of (reactivacionRows ?? []) as unknown as {
    client_id: string;
    scheduled_at: string;
    clients: { id: string; first_name: string; last_name: string; phone: string };
  }[]) {
    const existing = clientAgg.get(row.client_id);
    if (existing) {
      existing.totalSesiones++;
    } else {
      clientAgg.set(row.client_id, {
        id: row.clients.id,
        nombre: `${row.clients.first_name} ${row.clients.last_name}`.trim(),
        phone: row.clients.phone ?? "",
        lastVisit: new Date(row.scheduled_at),
        totalSesiones: 1,
      });
    }
  }

  const now = new Date();
  const reactivacionList = Array.from(clientAgg.values())
    .filter((c) => !futureClientIds.has(c.id) && c.lastVisit < fortyFiveDaysAgo)
    .map((c) => {
      const diasInactivo = Math.floor(
        (now.getTime() - c.lastVisit.getTime()) / (1000 * 60 * 60 * 24),
      );
      let segmento = "Activa";
      if (diasInactivo > 180) segmento = "Perdida";
      else if (diasInactivo > 90) segmento = "En riesgo";
      return {
        id: c.id,
        nombre: c.nombre,
        ultima_visita: formatDate(c.lastVisit),
        dias_inactivo: diasInactivo,
        total_sesiones: c.totalSesiones,
        phone: c.phone,
        segmento,
      };
    })
    .sort((a, b) => b.dias_inactivo - a.dias_inactivo)
    .slice(0, 200);

  const totalPages = Math.max(1, Math.ceil(reactivacionList.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageData = reactivacionList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Depilación</h1>
        <PeriodSelector currentDays={days} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Turnos realizados" value={realizados} />
        <StatCard title="Ocupación promedio" value={`${ocupacion}%`} />
        <StatCard
          title="Ticket promedio"
          value={ticketPromedio > 0 ? formatCurrency(Math.round(ticketPromedio)) : "—"}
        />
        <StatCard title="Clientes sin turno +60d" value={clientesSinTurno60} />
      </div>

      {/* Professional distribution */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Distribución por profesional</h2>
        </div>
        <div className="p-6">
          {professionalData.length > 0 ? (
            <ProfessionalChart data={professionalData} />
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">
              No hay datos de profesionales en el período seleccionado
            </p>
          )}
        </div>
      </div>

      {/* Demand heatmap */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Demanda por día y franja horaria
          </h2>
          <p className="mt-1 text-xs text-gray-500">Últimos 6 meses (excluye cancelados)</p>
        </div>
        <div className="p-6">
          <DemandHeatmap data={heatmapGrid} totalBookings={heatmapTotal} />
        </div>
      </div>

      {/* Reactivación table */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Clientes para reactivación
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Sin turno en próximos 30 días, última visita hace más de 45 días
          </p>
        </div>
        <div className="p-6">
          <ReactivacionTable
            data={pageData}
            currentPage={safePage}
            totalPages={totalPages}
            periodo={days}
          />
        </div>
      </div>
    </div>
  );
}
