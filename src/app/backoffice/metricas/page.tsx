import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

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

  // Fetch all sessions in the period
  const { data: sessions } = await client
    .from("conversation_sessions")
    .select("funnel_stage, last_message_at")
    .gte("last_message_at", periodStart);

  const rows = (sessions ?? []) as { funnel_stage: string | null; last_message_at: string }[];

  // Count sessions per funnel stage (cumulative: each stage includes sessions that reached at least that stage)
  const stageCounts: Record<string, number> = {};
  const stageOrder = FUNNEL_STAGES.map((s) => s.key);

  for (const stage of stageOrder) {
    const stageIdx = stageOrder.indexOf(stage);
    stageCounts[stage] = rows.filter((r) => {
      const rowIdx = stageOrder.indexOf((r.funnel_stage ?? "") as FunnelStage);
      return rowIdx >= stageIdx;
    }).length;
  }

  // Total = sessions with any funnel_stage (started at minimum)
  const total = stageCounts["started"] ?? 0;

  // Daily trend for the last period (sessions started per day)
  const dailyMap: Record<string, number> = {};
  for (const row of rows) {
    if (!row.funnel_stage) continue;
    const day = row.last_message_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + 1;
  }

  const selectedPeriod = PERIODS.find((p) => p.days === days) ?? PERIODS[1];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Métricas de conversión</h1>

        {/* Period selector */}
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <a
              key={p.days}
              href={`?periodo=${p.days}`}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                p.days === days
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.label.replace("Últimos ", "").replace(" días", "d")}
            </a>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500">{selectedPeriod.label}</p>

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
            <div key={stage.key} className="rounded-lg border bg-white p-5 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {stage.label}
                </p>
              </div>
              <p className="mt-2 text-3xl font-bold text-gray-900">{count}</p>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                <span>{convRate}% del total</span>
                {stepRate !== null && (
                  <span className="text-gray-400">· {stepRate}% del paso anterior</span>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gray-900 transition-all"
                  style={{ width: `${convRate}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Funnel summary table */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Resumen del funnel</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Etapa", "Sesiones", "Conv. total", "Conv. por paso", "Drop-off"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {total === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
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
                    <tr key={stage.key} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {i + 1}
                        </span>
                        {stage.label}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">
                        {count}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {convTotal}%
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {convStep === "—" ? "—" : `${convStep}%`}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
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

      {/* Daily activity */}
      {Object.keys(dailyMap).length > 0 && (
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Actividad diaria (sesiones activas)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Fecha", "Sesiones"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {Object.entries(dailyMap)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 14)
                  .map(([day, count]) => (
                    <tr key={day} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{day}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
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
