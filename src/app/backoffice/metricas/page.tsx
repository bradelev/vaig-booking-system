import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import DailyActivityChart from "@/components/backoffice/metrics/daily-activity-chart";
import FunnelChart from "@/components/backoffice/metrics/funnel-chart";
import PageHeader from "@/components/backoffice/page-header";

export const metadata: Metadata = { title: "Métricas" };

const FUNNEL_STAGES = [
  { key: "started", label: "Conversaciones iniciadas" },
  { key: "service_selected", label: "Seleccionaron servicio" },
  { key: "data_completed", label: "Completaron datos" },
  { key: "payment_done", label: "Pagaron seña" },
] as const;

type FunnelStage = (typeof FUNNEL_STAGES)[number]["key"];

interface PeriodOption {
  label: string;
  days: number;
}

const PERIODS: PeriodOption[] = [
  { label: "Últimos 7 días", days: 7 },
  { label: "Últimos 30 días", days: 30 },
  { label: "Últimos 90 días", days: 90 },
];

function getPeriodStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const days = Number(periodo) || 30;
  const periodStart = getPeriodStart(days);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: sessions } = await client
    .from("conversation_sessions")
    .select("funnel_stage, last_message_at")
    .gte("last_message_at", periodStart);

  const rows = (sessions ?? []) as { funnel_stage: string | null; last_message_at: string }[];

  const stageCounts: Record<string, number> = {};
  const stageOrder = FUNNEL_STAGES.map((s) => s.key);

  for (const stage of stageOrder) {
    const stageIdx = stageOrder.indexOf(stage);
    stageCounts[stage] = rows.filter((r) => {
      const rowIdx = stageOrder.indexOf((r.funnel_stage ?? "") as FunnelStage);
      return rowIdx >= stageIdx;
    }).length;
  }

  const total = stageCounts["started"] ?? 0;

  const dailyMap: Record<string, number> = {};
  for (const row of rows) {
    if (!row.funnel_stage) continue;
    const day = row.last_message_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + 1;
  }

  const selectedPeriod = PERIODS.find((p) => p.days === days) ?? PERIODS[1];

  const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const dailyChartData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => {
      const [, mm, dd] = day.split("-");
      const label = `${parseInt(dd)} ${MONTH_LABELS[parseInt(mm) - 1]}`;
      return { date: label, sesiones: count };
    });

  const funnelChartData = FUNNEL_STAGES.map((stage) => {
    const count = stageCounts[stage.key] ?? 0;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return { stage: stage.key, count, percentage };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas de conversión"
        subtitle={selectedPeriod.label}
        actions={
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <a
                key={p.days}
                href={`?periodo=${p.days}`}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.98] ${
                  p.days === days
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:bg-accent"
                }`}
              >
                {p.label.replace("Últimos ", "").replace(" días", "d")}
              </a>
            ))}
          </div>
        }
      />

      {/* Funnel cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FUNNEL_STAGES.map((stage, i) => {
          const count = stageCounts[stage.key] ?? 0;
          const prevCount = i > 0 ? (stageCounts[FUNNEL_STAGES[i - 1].key] ?? 0) : null;
          const convRate = total > 0 ? Math.round((count / total) * 100) : 0;
          const stepRate =
            prevCount !== null && prevCount > 0
              ? Math.round((count / prevCount) * 100)
              : null;

          return (
            <div key={stage.key} className="rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stage.label}
                </p>
              </div>
              <p className="mt-2 text-3xl font-bold text-foreground">{count}</p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>{convRate}% del total</span>
                {stepRate !== null && (
                  <span className="text-muted-foreground/60">{stepRate}% del paso anterior</span>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${convRate}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Actividad diaria</h2>
          </div>
          <div className="p-6">
            {dailyChartData.length > 0 ? (
              <DailyActivityChart data={dailyChartData} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay datos en el período seleccionado
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Embudo de conversión</h2>
          </div>
          <div className="p-6">
            {total > 0 ? (
              <FunnelChart data={funnelChartData} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay datos en el período seleccionado
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Funnel summary table */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Resumen del funnel</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                {["Etapa", "Sesiones", "Conv. total", "Conv. por paso", "Drop-off"].map((h) => (
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
              {total === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No hay datos de sesiones con funnel en el período seleccionado
                  </td>
                </tr>
              ) : (
                FUNNEL_STAGES.map((stage, i) => {
                  const count = stageCounts[stage.key] ?? 0;
                  const prevCount =
                    i > 0 ? (stageCounts[FUNNEL_STAGES[i - 1].key] ?? 0) : null;
                  const convTotal = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                  const convStep =
                    prevCount !== null && prevCount > 0
                      ? ((count / prevCount) * 100).toFixed(1)
                      : "—";
                  const dropoff =
                    prevCount !== null ? prevCount - count : null;

                  return (
                    <tr key={stage.key} className="transition-colors duration-150 hover:bg-muted/50">
                      <td className="px-4 py-4 text-sm font-medium text-foreground">
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                          {i + 1}
                        </span>
                        {stage.label}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-foreground">
                        {count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-foreground">
                        {convTotal}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-foreground">
                        {convStep === "—" ? "—" : `${convStep}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                        {dropoff !== null ? (dropoff > 0 ? `−${dropoff}` : "—") : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily activity table */}
      {Object.keys(dailyMap).length > 0 && (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Actividad diaria (sesiones activas)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  {["Fecha", "Sesiones"].map((h) => (
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
                {Object.entries(dailyMap)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 14)
                  .map(([day, count]) => (
                    <tr key={day} className="transition-colors duration-150 hover:bg-muted/50">
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-foreground">{day}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-foreground">
                        {count}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
