import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleServiceActive } from "@/actions/servicios";
import { formatCurrency } from "@/lib/utils";

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

      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Nombre", "Duración", "Precio", "Seña", "Profesional", "Estado", "Acciones"].map((h) => (
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
            {servicios.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                  No hay servicios creados aún
                </td>
              </tr>
            ) : (
              servicios.map((s) => {
                const toggleAction = toggleServiceActive.bind(null, s.id, s.is_active);
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{s.description}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {s.duration_minutes} min
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {formatCurrency(s.price)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {formatCurrency(s.deposit_amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {s.professionals?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {s.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
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
