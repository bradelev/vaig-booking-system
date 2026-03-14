import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { upsertProfessionalSchedule, DAYS } from "@/actions/schedule";

interface ScheduleRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
}

interface Professional {
  id: string;
  name: string;
}

export default async function HorarioProfesionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [{ data: profRaw }, { data: scheduleRaw }] = await Promise.all([
    client.from("professionals").select("id, name").eq("id", id).single(),
    client
      .from("professional_schedule")
      .select("day_of_week, start_time, end_time, is_working")
      .eq("professional_id", id),
  ]);

  const prof = profRaw as Professional | null;
  if (!prof) notFound();

  const schedule = (scheduleRaw ?? []) as ScheduleRow[];
  const scheduleMap = Object.fromEntries(schedule.map((s) => [s.day_of_week, s]));

  const saveAction = upsertProfessionalSchedule.bind(null, id);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/backoffice/profesionales" className="text-sm text-gray-500 hover:text-gray-800">
          ← Profesionales
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Horario — {prof.name}</h1>
      </div>

      <form action={saveAction} className="rounded-lg border bg-white p-6 shadow-sm space-y-4">
        <p className="text-sm text-gray-500">Configurá los días y horarios de atención.</p>

        {DAYS.map((day) => {
          const existing = scheduleMap[day.value];
          const defaultWorking = existing ? existing.is_working : day.value >= 1 && day.value <= 6;
          const defaultStart = existing?.start_time ?? "09:00";
          const defaultEnd = existing?.end_time ?? "18:00";

          return (
            <div key={day.value} className="grid grid-cols-[120px_auto_auto_auto] items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  name={`is_working_${day.value}`}
                  defaultChecked={defaultWorking}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900"
                />
                {day.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  name={`start_time_${day.value}`}
                  defaultValue={defaultStart}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                />
                <span className="text-gray-400 text-sm">a</span>
                <input
                  type="time"
                  name={`end_time_${day.value}`}
                  defaultValue={defaultEnd}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                />
              </div>
            </div>
          );
        })}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
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
            Guardar horario
          </button>
        </div>
      </form>
    </div>
  );
}
