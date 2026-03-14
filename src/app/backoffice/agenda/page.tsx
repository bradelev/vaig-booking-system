import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from "@/lib/utils";

interface AgendaBooking {
  id: string;
  scheduled_at: string;
  status: string;
  clients: { first_name: string; last_name: string } | null;
  services: { name: string; duration_minutes: number } | null;
  professionals: { id: string; name: string } | null;
}

interface Professional {
  id: string;
  name: string;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 to 20:00
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getMondayOfWeek(dateStr: string): Date {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const tz = "America/Argentina/Buenos_Aires";
  return `${monday.toLocaleDateString("es-AR", { ...opts, timeZone: tz })} – ${sunday.toLocaleDateString("es-AR", { ...opts, timeZone: tz })}`;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; profesional?: string }>;
}) {
  const { semana, profesional: filterProfId } = await searchParams;

  const TZ = "America/Argentina/Buenos_Aires";

  // Determine the week's Monday
  const weekParam = semana ?? new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
  const monday = getMondayOfWeek(weekParam);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [{ data: bookingsRaw }, { data: profsRaw }] = await Promise.all([
    client
      .from("bookings")
      .select(
        `id, scheduled_at, status,
         clients(first_name, last_name),
         services(name, duration_minutes),
         professionals(id, name)`
      )
      .gte("scheduled_at", monday.toISOString())
      .lte("scheduled_at", sunday.toISOString())
      .not("status", "in", '("cancelled","no_show")')
      .order("scheduled_at"),
    client.from("professionals").select("id, name").eq("is_active", true).order("name"),
  ]);

  const allBookings = (bookingsRaw ?? []) as AgendaBooking[];
  const professionals = (profsRaw ?? []) as Professional[];

  const bookings = filterProfId
    ? allBookings.filter((b) => b.professionals?.id === filterProfId)
    : allBookings;

  // Navigation dates
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  // Build week days array
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  // Map bookings to day+hour
  function getBookingsForCell(day: Date, hour: number): AgendaBooking[] {
    const dateStr = toDateStr(day);
    return bookings.filter((b) => {
      const dt = new Date(b.scheduled_at);
      const localDate = dt.toLocaleDateString("sv-SE", { timeZone: TZ });
      const localHour = parseInt(
        dt.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", hour12: false }),
        10
      );
      return localDate === dateStr && localHour === hour;
    });
  }

  const prevSemana = toDateStr(prevMonday);
  const nextSemana = toDateStr(nextMonday);

  const profQuery = filterProfId ? `&profesional=${filterProfId}` : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <div className="flex items-center gap-3">
          {/* Professional filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <Link
              href={`/backoffice/agenda?semana=${weekParam}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                !filterProfId ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Todos
            </Link>
            {professionals.map((p) => (
              <Link
                key={p.id}
                href={`/backoffice/agenda?semana=${weekParam}&profesional=${p.id}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterProfId === p.id
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <Link
              href={`/backoffice/agenda?semana=${prevSemana}${profQuery}`}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              ←
            </Link>
            <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
              {formatWeekLabel(monday)}
            </span>
            <Link
              href={`/backoffice/agenda?semana=${nextSemana}${profQuery}`}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              →
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-16 px-3 py-2 text-left text-xs font-medium text-gray-500 border-b border-r border-gray-200">
                Hora
              </th>
              {weekDays.map((day, i) => {
                const isToday =
                  toDateStr(day) === new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
                return (
                  <th
                    key={i}
                    className={`px-3 py-2 text-center text-xs font-medium border-b border-r border-gray-200 last:border-r-0 ${
                      isToday ? "bg-gray-900 text-white" : "text-gray-500"
                    }`}
                  >
                    <div>{DAYS[i]}</div>
                    <div
                      className={`text-base font-bold ${isToday ? "text-white" : "text-gray-900"}`}
                    >
                      {day.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour} className="border-b border-gray-100 last:border-b-0">
                <td className="px-3 py-1 text-xs text-gray-400 border-r border-gray-200 align-top whitespace-nowrap">
                  {String(hour).padStart(2, "0")}:00
                </td>
                {weekDays.map((day, i) => {
                  const cellBookings = getBookingsForCell(day, hour);
                  return (
                    <td
                      key={i}
                      className="px-1 py-1 align-top border-r border-gray-100 last:border-r-0 min-w-[120px]"
                    >
                      <div className="space-y-1">
                        {cellBookings.map((b) => (
                          <Link
                            key={b.id}
                            href={`/backoffice/citas/${b.id}/editar`}
                            className={`block rounded px-2 py-1 text-xs leading-tight hover:opacity-80 transition-opacity ${
                              BOOKING_STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700"
                            }`}
                          >
                            <div className="font-medium truncate">
                              {b.clients
                                ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
                                : "—"}
                            </div>
                            <div className="truncate opacity-80">{b.services?.name ?? "—"}</div>
                            {b.professionals && (
                              <div className="truncate opacity-70">{b.professionals.name}</div>
                            )}
                            <div className="opacity-60">
                              {BOOKING_STATUS_LABELS[b.status] ?? b.status}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
