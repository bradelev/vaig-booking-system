import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleServiceActive } from "@/actions/servicios";
import { formatCurrency } from "@/lib/utils";
import ResponsiveTable, { type TableColumn } from "@/components/backoffice/responsive-table";

interface Servicio {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  deposit_amount: number;
  is_active: boolean;
  professionals: { name: string } | null;
}

export default async function ServiciosPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("services")
    .select(
      `id, name, description, duration_minutes, price, deposit_amount, is_active,
       professionals(name)`
    )
    .order("name");

  const servicios = (raw ?? []) as Servicio[];

  const columns: TableColumn<Servicio>[] = [
    {
      header: "Nombre",
      primaryOnMobile: true,
      accessor: (s) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{s.name}</p>
          {s.description && (
            <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{s.description}</p>
          )}
        </div>
      ),
    },
    {
      header: "Duración",
      accessor: (s) => (
        <span className="whitespace-nowrap">{s.duration_minutes} min</span>
      ),
    },
    {
      header: "Precio",
      accessor: (s) => (
        <span className="whitespace-nowrap">{formatCurrency(s.price)}</span>
      ),
    },
    {
      header: "Seña",
      accessor: (s) => (
        <span className="whitespace-nowrap">{formatCurrency(s.deposit_amount)}</span>
      ),
    },
    {
      header: "Profesional",
      accessor: (s) => s.professionals?.name ?? "—",
    },
    {
      header: "Estado",
      accessor: (s) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            s.is_active
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {s.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      header: "Acciones",
      accessor: (s) => {
        const toggleAction = toggleServiceActive.bind(null, s.id, s.is_active);
        return (
          <div className="flex items-center gap-3">
            <Link
              href={`/backoffice/servicios/${s.id}/editar`}
              className="text-sm text-blue-600 hover:underline"
            >
              Editar
            </Link>
            <form action={toggleAction}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
              >
                {s.is_active ? "Desactivar" : "Activar"}
              </button>
            </form>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
        <Link
          href="/backoffice/servicios/nuevo"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Nuevo servicio
        </Link>
      </div>

      <ResponsiveTable
        columns={columns}
        data={servicios}
        keyExtractor={(s) => s.id}
        emptyMessage="No hay servicios creados aún"
      />
    </div>
  );
}
