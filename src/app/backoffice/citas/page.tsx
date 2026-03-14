import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/backoffice/status-badge";
import { formatDate, formatTime } from "@/lib/utils";
import { updateBookingStatus } from "@/actions/citas";

interface Booking {
  id: string;
  scheduled_at: string;
  status: string;
  clients: { first_name: string; last_name: string; phone: string } | null;
  services: { name: string } | null;
  professionals: { name: string } | null;
}

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  pending: [{ status: "deposit_paid", label: "Seña pagada" }],
  deposit_paid: [{ status: "confirmed", label: "Confirmar" }],
  confirmed: [
    { status: "realized", label: "Realizado" },
    { status: "no_show", label: "No show" },
  ],
};

const PERIOD_FILTERS = [
  { label: "Hoy", value: "hoy" },
  { label: "Semana", value: "semana" },
  { label: "Mes", value: "mes" },
  { label: "Rango", value: "rango" },
] as const;

const STATUS_OPTIONS = [
  { label: "Todos los estados", value: "" },
  { label: "Pendiente", value: "pending" },
  { label: "Seña pagada", value: "deposit_paid" },
  { label: "Confirmada", value: "confirmed" },
  { label: "Realizada", value: "realized" },
  { label: "Cancelada", value: "cancelled" },
  { label: "No se presentó", value: "no_show" },
];

const PAGE_SIZE = 20;

function getDateRange(filtro: string, desde?: string, hasta?: string) {
  const now = new Date();

  if (filtro === "rango" && desde && hasta) {
    return { start: `${desde}T00:00:00`, end: `${hasta}T23:59:59` };
  }

  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (filtro === "semana") {
    const day = now.getDay();
    start.setDate(now.getDate() - day);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (filtro === "mes") {
    start.setDate(1);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function buildSearchParams(
  overrides: Record<string, string | undefined>,
  base: Record<string, string | undefined>
) {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  return params.toString();
}

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{
    filtro?: string;
    desde?: string;
    hasta?: string;
    estado?: string;
    profesional?: string;
    servicio?: string;
    busqueda?: string;
    pagina?: string;
  }>;
}) {
  const params = await searchParams;
  const filtro = params.filtro ?? "hoy";
  const desde = params.desde;
  const hasta = params.hasta;
  const estado = params.estado ?? "";
  const profesionalId = params.profesional ?? "";
  const servicioId = params.servicio ?? "";
  const busqueda = params.busqueda ?? "";
  const pagina = Math.max(1, parseInt(params.pagina ?? "1", 10));

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Load selects data
  const [{ data: profesionales }, { data: servicios }] = await Promise.all([
    client.from("professionals").select("id, name").order("name"),
    client.from("services").select("id, name").order("name"),
  ]);

  const { start, end } = getDateRange(filtro, desde, hasta);

  // Resolve search by client name/phone
  let clientIds: string[] | undefined;
  if (busqueda) {
    const { data: matchedClients } = await client
      .from("clients")
      .select("id")
      .or(
        `first_name.ilike.%${busqueda}%,last_name.ilike.%${busqueda}%,phone.ilike.%${busqueda}%`
      );
    const ids: string[] = (matchedClients ?? []).map((c: { id: string }) => c.id);
    // No matching clients → empty results
    clientIds = ids.length === 0 ? ["00000000-0000-0000-0000-000000000000"] : ids;
  }

  const from = (pagina - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Build query
  let query = client
    .from("bookings")
    .select(
      `id, scheduled_at, status,
       clients(first_name, last_name, phone),
       services(name),
       professionals(name)`,
      { count: "exact" }
    )
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .order("scheduled_at")
    .range(from, to);

  if (estado) query = query.eq("status", estado);
  if (profesionalId) query = query.eq("professional_id", profesionalId);
  if (servicioId) query = query.eq("service_id", servicioId);
  if (clientIds !== undefined) query = query.in("client_id", clientIds);

  const { data: raw, count } = await query;
  const bookings = (raw ?? []) as Booking[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Build CSV link params (same filters, no pagination)
  const csvParams = buildSearchParams(
    {},
    { filtro, desde, hasta, estado, profesional: profesionalId, servicio: servicioId, busqueda }
  );

  // Current params for pagination links
  const baseParams = { filtro, desde, hasta, estado, profesional: profesionalId, servicio: servicioId, busqueda };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Citas</h1>
        <Link
          href="/backoffice/citas/nueva"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Nueva cita
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {/* Period tabs */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {PERIOD_FILTERS.map((f) => (
              <button
                key={f.value}
                type="submit"
                name="filtro"
                value={f.value}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  filtro === f.value
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Date range inputs (visible only when filtro=rango) */}
          {filtro === "rango" && (
            <>
              <input
                type="date"
                name="desde"
                defaultValue={desde}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <input
                type="date"
                name="hasta"
                defaultValue={hasta}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </>
          )}
          {/* Keep filtro value for non-period submits */}
          {filtro !== "rango" && (
            <input type="hidden" name="filtro" value={filtro} />
          )}

          <select
            name="estado"
            defaultValue={estado}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            name="profesional"
            defaultValue={profesionalId}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">Todos los profesionales</option>
            {(profesionales ?? []).map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            name="servicio"
            defaultValue={servicioId}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">Todos los servicios</option>
            {(servicios ?? []).map((s: { id: string; name: string }) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            name="busqueda"
            defaultValue={busqueda}
            placeholder="Nombre o teléfono..."
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm min-w-[180px]"
          />

          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Filtrar
          </button>

          <a
            href={`/backoffice/citas/csv?${csvParams}`}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Exportar CSV
          </a>
        </div>
      </form>

      {/* Table */}
      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Fecha/Hora", "Cliente", "Teléfono", "Servicio", "Profesional", "Estado", "Acciones"].map((h) => (
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
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                  No hay citas con los filtros seleccionados
                </td>
              </tr>
            ) : (
              bookings.map((b) => {
                const actions = NEXT_STATUS[b.status] ?? [];
                const clientName = b.clients
                  ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
                  : "—";

                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      <p className="font-medium">{formatDate(b.scheduled_at)}</p>
                      <p className="text-gray-500">{formatTime(b.scheduled_at)}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{clientName}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {b.clients?.phone ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {b.services?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {b.professionals?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/backoffice/citas/${b.id}/editar`}
                          className="whitespace-nowrap text-sm text-blue-600 hover:underline"
                        >
                          Editar
                        </Link>
                        {actions.map((action) => {
                          const actionFn = updateBookingStatus.bind(null, b.id, action.status);
                          return (
                            <form key={action.status} action={actionFn}>
                              <button
                                type="submit"
                                className="whitespace-nowrap rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                {action.label}
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Mostrando {from + 1}–{Math.min(to + 1, total)} de {total}
          </span>
          <div className="flex gap-2">
            {pagina > 1 ? (
              <Link
                href={`/backoffice/citas?${buildSearchParams({ pagina: String(pagina - 1) }, baseParams)}`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                Anterior
              </Link>
            ) : (
              <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-300">Anterior</span>
            )}
            {pagina < totalPages ? (
              <Link
                href={`/backoffice/citas?${buildSearchParams({ pagina: String(pagina + 1) }, baseParams)}`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                Siguiente
              </Link>
            ) : (
              <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-300">Siguiente</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
