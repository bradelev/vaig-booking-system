import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { togglePackageActive } from "@/actions/paquetes";
import { formatCurrency } from "@/lib/utils";
import ResponsiveTable, { type TableColumn } from "@/components/backoffice/responsive-table";

interface Paquete {
  id: string;
  name: string;
  session_count: number;
  price: number;
  is_active: boolean;
  services: { name: string } | null;
}

export default async function PaquetesPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("service_packages")
    .select("id, name, session_count, price, is_active, services(name)")
    .order("name");

  const paquetes = (raw ?? []) as Paquete[];

  const columns: TableColumn<Paquete>[] = [
    {
      header: "Nombre",
      primaryOnMobile: true,
      accessor: (p) => (
        <p className="text-sm font-medium text-gray-900">{p.name}</p>
      ),
    },
    {
      header: "Servicio",
      accessor: (p) => p.services?.name ?? "—",
    },
    {
      header: "Sesiones",
      accessor: (p) => (
        <span className="whitespace-nowrap">{p.session_count}</span>
      ),
    },
    {
      header: "Precio",
      accessor: (p) => (
        <span className="whitespace-nowrap">{formatCurrency(p.price)}</span>
      ),
    },
    {
      header: "Estado",
      accessor: (p) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            p.is_active
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {p.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      header: "Acciones",
      accessor: (p) => {
        const toggleAction = togglePackageActive.bind(null, p.id, p.is_active);
        return (
          <div className="flex items-center gap-3">
            <Link
              href={`/backoffice/paquetes/${p.id}/editar`}
              className="text-sm text-blue-600 hover:underline"
            >
              Editar
            </Link>
            <form action={toggleAction}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
              >
                {p.is_active ? "Desactivar" : "Activar"}
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
        <h1 className="text-2xl font-bold text-gray-900">Paquetes</h1>
        <Link
          href="/backoffice/paquetes/nuevo"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Nuevo paquete
        </Link>
      </div>

      <ResponsiveTable
        columns={columns}
        data={paquetes}
        keyExtractor={(p) => p.id}
        emptyMessage="No hay paquetes creados aún"
      />
    </div>
  );
}
