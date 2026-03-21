import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createPackage } from "@/actions/paquetes";
import ValidatedForm from "@/components/backoffice/validated-form";

interface Servicio {
  id: string;
  name: string;
}

export default async function NuevoPaquetePage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("services")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const servicios = (raw ?? []) as Servicio[];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/backoffice/paquetes" className="text-sm text-gray-500 hover:text-gray-800">
          ← Paquetes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo paquete</h1>
      </div>

      <ValidatedForm action={createPackage} className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            name="name"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Servicio *</label>
          <select
            name="service_id"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">Seleccionar servicio</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Cantidad de sesiones *</label>
            <input
              name="session_count"
              type="number"
              min={1}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Precio *</label>
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/backoffice/paquetes"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Crear paquete
          </button>
        </div>
      </ValidatedForm>
    </div>
  );
}
