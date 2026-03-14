import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateClient_ } from "@/actions/clientes";

interface Cliente {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  source: string | null;
}

const SOURCES = ["manual", "whatsapp", "instagram", "referido", "web"] as const;

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("clients")
    .select("id, first_name, last_name, phone, email, notes, source")
    .eq("id", id)
    .single();

  const cliente = raw as Cliente | null;
  if (!cliente) notFound();

  const updateAction = updateClient_.bind(null, id);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/backoffice/clientes" className="text-sm text-gray-500 hover:text-gray-800">
          ← Clientes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar cliente</h1>
      </div>

      <form action={updateAction} className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre *</label>
            <input
              name="first_name"
              required
              defaultValue={cliente.first_name}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Apellido *</label>
            <input
              name="last_name"
              required
              defaultValue={cliente.last_name}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Teléfono *</label>
          <input
            name="phone"
            required
            defaultValue={cliente.phone}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={cliente.email ?? ""}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Fuente</label>
          <select
            name="source"
            defaultValue={cliente.source ?? "manual"}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notas</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={cliente.notes ?? ""}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/backoffice/clientes"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
