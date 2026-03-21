/**
 * VBS-38 — Manual payment confirmation page.
 * Shows bookings in "pending" status awaiting deposit payment and allows
 * the admin to mark them as paid (bank transfer confirmation).
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pagos" };
import { confirmPayment } from "@/actions/pagos";
import { formatDate, formatTime } from "@/lib/utils";
import StatusBadge from "@/components/backoffice/status-badge";
import ResponsiveTable, { type TableColumn } from "@/components/backoffice/responsive-table";

interface PendingBooking {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  clients: { first_name: string; last_name: string; phone: string } | null;
  services: { name: string; deposit_amount: number } | null;
  professionals: { name: string } | null;
}

export default async function PagosPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("bookings")
    .select(
      `id, scheduled_at, status, notes,
       clients(first_name, last_name, phone),
       services(name, deposit_amount),
       professionals(name)`
    )
    .eq("status", "pending")
    .order("scheduled_at");

  const bookings = (raw ?? []) as PendingBooking[];

  const columns: TableColumn<PendingBooking>[] = [
    {
      header: "Turno",
      primaryOnMobile: true,
      accessor: (b) => (
        <div>
          <p className="font-medium">{formatDate(b.scheduled_at)}</p>
          <p className="text-gray-500">{formatTime(b.scheduled_at)}</p>
        </div>
      ),
    },
    {
      header: "Cliente",
      accessor: (b) =>
        b.clients
          ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
          : "—",
    },
    {
      header: "Teléfono",
      hideOnMobile: true,
      accessor: (b) => (
        <span className="whitespace-nowrap">{b.clients?.phone ?? "—"}</span>
      ),
    },
    {
      header: "Servicio",
      accessor: (b) => b.services?.name ?? "—",
    },
    {
      header: "Seña",
      accessor: (b) => {
        const depositAmount = b.services?.deposit_amount ?? 0;
        return (
          <span className="whitespace-nowrap font-medium text-gray-900">
            ${Number(depositAmount).toLocaleString("es-AR")}
          </span>
        );
      },
    },
    {
      header: "Profesional",
      hideOnMobile: true,
      accessor: (b) => b.professionals?.name ?? "—",
    },
    {
      header: "Estado",
      accessor: (b) => <StatusBadge status={b.status} />,
    },
    {
      header: "Acción",
      accessor: (b) => {
        const confirmFn = confirmPayment.bind(null, b.id);
        return (
          <form action={confirmFn}>
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
            >
              Confirmar seña
            </button>
          </form>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos pendientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Reservas esperando confirmación de seña por transferencia bancaria
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
          {bookings.length} pendiente{bookings.length !== 1 ? "s" : ""}
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">No hay pagos pendientes de confirmación.</p>
        </div>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={bookings}
          keyExtractor={(b) => b.id}
          emptyMessage="No hay pagos pendientes de confirmación."
        />
      )}
    </div>
  );
}
