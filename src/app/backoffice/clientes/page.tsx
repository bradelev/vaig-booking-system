import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

interface Cliente {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  source: string | null;
  created_at: string;
}

export default async function ClientesPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("clients")
    .select("id, first_name, last_name, phone, email, source, created_at")
    .order("created_at", { ascending: false });

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
              {["Nombre", "Teléfono", "Email", "Fuente", "Registro", "Acciones"].map((h) => (
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
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  No hay clientes registrados aún
                </td>
              </tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <Link href={`/backoffice/clientes/${c.id}`} className="hover:underline">
                      {c.first_name} {c.last_name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{c.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{c.email ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 capitalize">{c.source ?? "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(c.created_at)}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
