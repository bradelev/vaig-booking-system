import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { togglePackageActive } from "@/actions/paquetes";
import { formatCurrency } from "@/lib/utils";

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

      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Nombre", "Servicio", "Sesiones", "Precio", "Estado", "Acciones"].map((h) => (
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
            {paquetes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  No hay paquetes creados aún
                </td>
              </tr>
            ) : (
              paquetes.map((p) => {
                const toggleAction = togglePackageActive.bind(null, p.id, p.is_active);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {p.services?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {p.session_count}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          p.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
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
