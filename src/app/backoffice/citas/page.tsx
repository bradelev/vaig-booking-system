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

const FILTERS = [
  { label: "Hoy", value: "hoy" },
  { label: "Semana", value: "semana" },
  { label: "Mes", value: "mes" },
] as const;

function getDateRange(filter: string) {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (filter === "semana") {
    const day = now.getDay();
    start.setDate(now.getDate() - day);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (filter === "mes") {
    start.setDate(1);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  pending: [{ status: "deposit_paid", label: "Seña pagada" }],
  deposit_paid: [{ status: "confirmed", label: "Confirmar" }],
  confirmed: [
    { status: "realized", label: "Realizado" },
    { status: "no_show", label: "No show" },
  ],
};

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro = "hoy" } = await searchParams;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { start, end } = getDateRange(filtro);

  const { data: raw } = await client
    .from("bookings")
    .select(
      `id, scheduled_at, status,
       clients(first_name, last_name, phone),
       services(name),
       professionals(name)`
    )
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .order("scheduled_at");

  const bookings = (raw ?? []) as Booking[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Citas</h1>

        <div className="flex items-center gap-3">
          <Link
            href="/backoffice/citas/nueva"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            + Nueva cita
          </Link>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {FILTERS.map((f) => (
              <a
                key={f.value}
                href={`/backoffice/citas?filtro=${f.value}`}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filtro === f.value
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </a>
            ))}
          </div>
        </div>
      </div>

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
                  No hay citas en este período
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
    </div>
  );
}
