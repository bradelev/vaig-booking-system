import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NuevaCitaForm from "./nueva-cita-form";

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

      <NuevaCitaForm
        clientes={clientes}
        servicios={servicios}
        profesionales={profesionales}
        defaultDatetime={defaultDatetime}
      />
    </div>
  );
}
