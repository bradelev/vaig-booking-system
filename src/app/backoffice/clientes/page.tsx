import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface Cliente {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  total_sesiones: number;
  dias_inactivo: number | null;
  segmento: string | null;
}

const SEGMENTO_BADGE: Record<string, { label: string; cls: string }> = {
  S5: { label: "S5 VIP",       cls: "bg-purple-100 text-purple-800" },
  S4: { label: "S4 1ra visita", cls: "bg-blue-100 text-blue-800"   },
  S3: { label: "S3 Cross-sell", cls: "bg-green-100 text-green-800" },
  S2: { label: "S2 Cuponera",   cls: "bg-yellow-100 text-yellow-800" },
  S1: { label: "S1 Dormido",    cls: "bg-red-100 text-red-800"     },
};

function isPlaceholderPhone(phone: string): boolean {
  return phone.startsWith("historico_") || phone.startsWith("migrated_nophone_");
}

export default async function ClientesPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("clientes_metricas")
    .select("id, first_name, last_name, phone, email, total_sesiones, dias_inactivo, segmento")
    .order("first_name", { ascending: true });

  const clientes = (raw ?? []) as Cliente[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <Link
          href="/backoffice/clientes/nuevo"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Nuevo cliente
        </Link>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Nombre", "Teléfono", "Email", "Sesiones", "Última visita", "Segmento", "Acciones"].map((h) => (
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
            {clientes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                  No hay clientes registrados aún
                </td>
              </tr>
            ) : (
              clientes.map((c) => {
                const badge = c.segmento ? SEGMENTO_BADGE[c.segmento] : null;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <Link href={`/backoffice/clientes/${c.id}`} className="hover:underline">
                        {c.first_name} {c.last_name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {isPlaceholderPhone(c.phone) ? "—" : c.phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.email ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 text-center">
                      {c.total_sesiones}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {c.dias_inactivo != null ? `hace ${c.dias_inactivo} días` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {badge ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/backoffice/clientes/${c.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Ver
                      </Link>
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
