import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfessional, toggleProfessionalActive } from "@/actions/profesionales";

interface Professional {
  id: string;
  name: string;
  specialties: string[] | null;
  is_active: boolean;
}

export default async function EditarProfesionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("professionals")
    .select("id, name, specialties, is_active")
    .eq("id", id)
    .single();

  const profesional = raw as Professional | null;
  if (!profesional) notFound();

  const updateAction = updateProfessional.bind(null, id);
  const toggleAction = toggleProfessionalActive.bind(null, id, profesional.is_active);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/backoffice/profesionales" className="text-sm text-gray-500 hover:text-gray-800">
          ← Profesionales
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar profesional</h1>
      </div>

      <form action={updateAction} className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            name="name"
            required
            defaultValue={profesional.name}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Especialidades</label>
          <input
            name="specialties"
            defaultValue={(profesional.specialties ?? []).join(", ")}
            placeholder="Ej: Masajes, Reflexología, Reiki"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">Separadas por coma</p>
        </div>

        <div className="flex justify-between items-center pt-2">
          <form action={toggleAction}>
            <button
              type="submit"
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                profesional.is_active
                  ? "border-red-300 text-red-700 hover:bg-red-50"
                  : "border-green-300 text-green-700 hover:bg-green-50"
              }`}
            >
              {profesional.is_active ? "Desactivar" : "Activar"}
            </button>
          </form>

          <div className="flex gap-3">
            <Link
              href="/backoffice/profesionales"
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
