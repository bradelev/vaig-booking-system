import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createBooking } from "@/actions/citas";
import ValidatedForm from "@/components/backoffice/validated-form";

interface Cliente {
  id: string;
  first_name: string;
  last_name: string;
}

interface Servicio {
  id: string;
  name: string;
}

interface Professional {
  id: string;
  name: string;
}

export default async function NuevaCitaPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [{ data: clientesRaw }, { data: serviciosRaw }, { data: profsRaw }] = await Promise.all([
    client.from("clients").select("id, first_name, last_name").order("last_name"),
    client.from("services").select("id, name").eq("is_active", true).order("name"),
    client.from("professionals").select("id, name").eq("is_active", true).order("name"),
  ]);

  const clientes = (clientesRaw ?? []) as Cliente[];
  const servicios = (serviciosRaw ?? []) as Servicio[];
  const profesionales = (profsRaw ?? []) as Professional[];

  // Default datetime: next hour rounded
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const defaultDatetime = now.toISOString().slice(0, 16);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/backoffice/citas" className="text-sm text-gray-500 hover:text-gray-800">
          ← Citas
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva cita</h1>
      </div>

      <ValidatedForm action={createBooking} className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Cliente *</label>
          <select
            name="client_id"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">Seleccionar cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
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

        <div>
          <label className="block text-sm font-medium text-gray-700">Profesional</label>
          <select
            name="professional_id"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">Sin asignar</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha y hora *</label>
          <input
            name="scheduled_at"
            type="datetime-local"
            required
            defaultValue={defaultDatetime}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notas</label>
          <textarea
            name="notes"
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/backoffice/citas"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Crear cita
          </button>
        </div>
      </ValidatedForm>
    </div>
  );
}
