import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePackage, togglePackageActive } from "@/actions/paquetes";

interface Paquete {
  id: string;
  name: string;
  service_id: string;
  session_count: number;
  price: number;
  is_active: boolean;
}

interface Servicio {
  id: string;
  name: string;
}

export default async function EditarPaquetePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [{ data: raw }, { data: serviciosRaw }] = await Promise.all([
    client.from("service_packages").select("*").eq("id", id).single(),
    client.from("services").select("id, name").eq("is_active", true).order("name"),
  ]);

  const paquete = raw as Paquete | null;
  if (!paquete) notFound();

  const servicios = (serviciosRaw ?? []) as Servicio[];

  const updateAction = updatePackage.bind(null, id);
  const toggleAction = togglePackageActive.bind(null, id, paquete.is_active);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/backoffice/paquetes" className="text-sm text-gray-500 hover:text-gray-800">
          ← Paquetes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar paquete</h1>
      </div>

      <form action={updateAction} className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            name="name"
            required
            defaultValue={paquete.name}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Servicio *</label>
          <select
            name="service_id"
            required
            defaultValue={paquete.service_id}
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
              defaultValue={paquete.session_count}
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
              defaultValue={Number(paquete.price)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <form action={toggleAction}>
            <button
              type="submit"
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                paquete.is_active
                  ? "border-red-300 text-red-700 hover:bg-red-50"
                  : "border-green-300 text-green-700 hover:bg-green-50"
              }`}
            >
              {paquete.is_active ? "Desactivar paquete" : "Activar paquete"}
            </button>
          </form>

          <div className="flex gap-3">
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
              Guardar cambios
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
