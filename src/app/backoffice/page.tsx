import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/backoffice/stat-card";
import StatusBadge from "@/components/backoffice/status-badge";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { confirmPayment } from "@/actions/pagos";

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

interface PendingBooking {
  id: string;
  scheduled_at: string;
  clients: { first_name: string; last_name: string } | null;
  services: { name: string; deposit_amount: number } | null;
}

export default async function BackofficePage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [
    { count: todayCount },
    { count: pendingCount },
    { count: clientsCount },
    { data: todayBookingsRaw },
    { data: todayPaymentsRaw },
    { data: pendingBookingsRaw },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString()),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
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
    client
      .from("bookings")
      .select(
        `id, scheduled_at,
         clients(first_name, last_name),
         services(name, deposit_amount)`
      )
      .eq("status", "pending")
      .order("scheduled_at")
      .limit(20),
  ]);

  const todayBookings = (todayBookingsRaw ?? []) as unknown as TodayBooking[];
  const todayPayments = (todayPaymentsRaw ?? []) as unknown as Payment[];
  const pendingBookings = (pendingBookingsRaw ?? []) as unknown as PendingBooking[];

  const ingresos = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Citas hoy" value={todayCount ?? 0} />
        <StatCard title="Pendientes" value={pendingCount ?? 0} subtitle="sin seña" />
        <StatCard title="Clientes" value={clientsCount ?? 0} subtitle="total registrados" />
        <StatCard title="Ingresos hoy" value={formatCurrency(ingresos)} subtitle="cobros del día" />
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Citas de hoy</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Hora", "Cliente", "Servicio", "Profesional", "Estado"].map((h) => (
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
              {todayBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No hay citas para hoy
                  </td>
                </tr>
              ) : (
                todayBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {formatTime(b.scheduled_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {b.clients
                        ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
                        : "—"}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Pagos pendientes de confirmación</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Cliente", "Servicio", "Seña esperada", "Fecha reserva", "Acción"].map((h) => (
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
              {pendingBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No hay pagos pendientes
                  </td>
                </tr>
              ) : (
                pendingBookings.map((b) => {
                  const confirmAction = confirmPayment.bind(null, b.id);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {b.clients
                          ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {b.services?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {formatCurrency(b.services?.deposit_amount ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(b.scheduled_at)}
                      </td>
                      <td className="px-6 py-4">
                        <form action={confirmAction}>
                          <button
                            type="submit"
                            className="rounded border border-green-300 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
                          >
                            Confirmar pago
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
