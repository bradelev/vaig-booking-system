import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfessional, toggleProfessionalActive, disconnectGoogleCalendar } from "@/actions/profesionales";

interface Professional {
  id: string;
  name: string;
  specialties: string[] | null;
  is_active: boolean;
  google_refresh_token: string | null;
  google_calendar_id: string | null;
}

export default async function EditarProfesionalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gcal?: string }>;
}) {
  const { id } = await params;
  const { gcal } = await searchParams;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("professionals")
    .select("id, name, specialties, is_active, google_refresh_token, google_calendar_id")
    .eq("id", id)
    .single();

  const profesional = raw as Professional | null;
  if (!profesional) notFound();

  const updateAction = updateProfessional.bind(null, id);
  const toggleAction = toggleProfessionalActive.bind(null, id, profesional.is_active);
  const disconnectAction = disconnectGoogleCalendar.bind(null, id);

  const isCalendarConnected = !!profesional.google_refresh_token;
  const gcalConnectUrl = `/api/oauth/google?professionalId=${id}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/backoffice/profesionales" className="text-sm text-gray-500 hover:text-gray-800">
          ← Profesionales
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar profesional</h1>
      </div>

      {gcal === "connected" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Google Calendar conectado correctamente.
        </div>
      )}
      {gcal === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Error al conectar Google Calendar. Intentá de nuevo.
        </div>
      )}

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

      {/* Google Calendar */}
      <div className="rounded-lg border bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Google Calendar</h2>

        {isCalendarConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Calendario conectado. Los turnos confirmados se crean automáticamente.
            </div>
            <form action={disconnectAction}>
              <button
                type="submit"
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
              >
                Desconectar Google Calendar
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Conectá el Google Calendar del profesional para crear eventos automáticamente al confirmar turnos.
            </p>
            <a
              href={gcalConnectUrl}
              className="inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Conectar Google Calendar
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
