import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleProfessionalActive } from "@/actions/profesionales";
import ResponsiveTable, { type TableColumn } from "@/components/backoffice/responsive-table";

interface Professional {
  id: string;
  name: string;
  specialties: string[] | null;
  is_active: boolean;
}

export default async function ProfesionalesPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("professionals")
    .select("id, name, specialties, is_active")
    .order("name");

  const profesionales = (raw ?? []) as Professional[];

  const columns: TableColumn<Professional>[] = [
    {
      header: "Nombre",
      primaryOnMobile: true,
      accessor: (p) => (
        <span className="text-sm font-medium text-gray-900">{p.name}</span>
      ),
    },
    {
      header: "Especialidades",
      accessor: (p) =>
        p.specialties && p.specialties.length > 0
          ? p.specialties.join(", ")
          : "—",
    },
    {
      header: "Estado",
      accessor: (p) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            p.is_active
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {p.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      header: "Acciones",
      accessor: (p) => {
        const toggleAction = toggleProfessionalActive.bind(null, p.id, p.is_active);
        return (
          <div className="flex items-center gap-3">
            <Link
              href={`/backoffice/profesionales/${p.id}/editar`}
              className="text-sm text-blue-600 hover:underline"
            >
              Editar
            </Link>
            <Link
              href={`/backoffice/profesionales/${p.id}/horario`}
              className="text-sm text-blue-600 hover:underline"
            >
              Horario
            </Link>
            <form action={toggleAction}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
              >
                {p.is_active ? "Desactivar" : "Activar"}
              </button>
            </form>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profesionales</h1>
        <Link
          href="/backoffice/profesionales/nuevo"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Nuevo profesional
        </Link>
      </div>

      <ResponsiveTable
        columns={columns}
        data={profesionales}
        keyExtractor={(p) => p.id}
        emptyMessage="No hay profesionales creados aún"
      />
    </div>
  );
}
