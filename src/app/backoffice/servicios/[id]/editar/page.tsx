import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateService, toggleServiceActive } from "@/actions/servicios";

interface Servicio {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  deposit_amount: number;
  is_active: boolean;
  default_professional_id: string | null;
}

interface Professional {
  id: string;
  name: string;
}

export default async function EditarServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [{ data: raw }, { data: profsRaw }] = await Promise.all([
    client.from("services").select("*").eq("id", id).single(),
    client.from("professionals").select("id, name").eq("is_active", true).order("name"),
  ]);

  const servicio = raw as Servicio | null;
  if (!servicio) notFound();

  const professionals = (profsRaw ?? []) as Professional[];

  const updateAction = updateService.bind(null, id);
  const toggleAction = toggleServiceActive.bind(null, id, servicio.is_active);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/backoffice/servicios" className="text-sm text-gray-500 hover:text-gray-800">
          ← Servicios
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar servicio</h1>
      </div>

      <form action={updateAction} className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            name="name"
            required
            defaultValue={servicio.name}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={servicio.description ?? ""}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Duración (min) *</label>
            <input
              name="duration_minutes"
              type="number"
              min={1}
              required
              defaultValue={servicio.duration_minutes}
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
              defaultValue={Number(servicio.price)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Monto de seña *</label>
          <input
            name="deposit_amount"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={Number(servicio.deposit_amount)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Profesional por defecto</label>
          <select
            name="default_professional_id"
            defaultValue={servicio.default_professional_id ?? ""}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">Sin asignar</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-between items-center pt-2">
          <form action={toggleAction}>
            <button
              type="submit"
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                servicio.is_active
                  ? "border-red-300 text-red-700 hover:bg-red-50"
                  : "border-green-300 text-green-700 hover:bg-green-50"
              }`}
            >
              {servicio.is_active ? "Desactivar servicio" : "Activar servicio"}
            </button>
          </form>

          <div className="flex gap-3">
            <Link
              href="/backoffice/servicios"
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
