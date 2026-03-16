"use client";

import {
  AgendaEvent,
  TZ,
  PROFESSIONAL_COLORS,
  PROFESSIONAL_COLORS_FALLBACK,
  GCAL_COLOR_MAP,
  getLocalDate,
  toDateStr,
} from "./agenda-types";

interface MonthViewProps {
  currentDate: Date;
  events: AgendaEvent[];
  onDayClick: (day: Date) => void;
}

function getMonthGrid(currentDate: Date): (Date | null)[][] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Align to Monday (0=Mon in our grid)
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  // Pad to complete weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function getEventColor(event: AgendaEvent): string {
  if (event.source === "booking" && event.professionalName) {
    return (PROFESSIONAL_COLORS[event.professionalName] ?? PROFESSIONAL_COLORS_FALLBACK).bg;
  }
  if (event.source === "gcal" && event.gcalColorId && GCAL_COLOR_MAP[event.gcalColorId]) {
    return GCAL_COLOR_MAP[event.gcalColorId].solidBg;
  }
  return PROFESSIONAL_COLORS_FALLBACK.bg;
}

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function MonthView({ currentDate, events, onDayClick }: MonthViewProps) {
  const weeks = getMonthGrid(currentDate);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

  return (
    <div className="flex-1 rounded-lg border bg-white shadow-sm overflow-auto">
      {/* Day names header */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
          {week.map((day, di) => {
            if (!day) {
              return <div key={di} className="min-h-[80px] bg-gray-50/50" />;
            }
            const dateStr = toDateStr(day);
            const isToday = dateStr === today;
            const dayEvents = events
              .filter((e) => getLocalDate(e.scheduled_at) === dateStr)
              .slice(0, 4); // limit display
            const totalEvents = events.filter((e) => getLocalDate(e.scheduled_at) === dateStr).length;
            const overflow = totalEvents - dayEvents.length;

            return (
              <div
                key={di}
                className="min-h-[80px] p-1 border-l border-gray-100 first:border-l-0 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => onDayClick(day)}
              >
                <div className="flex justify-end mb-1">
                  <span
                    className={`text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full ${
                      isToday ? "bg-gray-900 text-white" : "text-gray-700"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] text-white font-medium ${getEventColor(event)}`}
                    >
                      {event.clientName}
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[10px] text-gray-500 pl-1">+{overflow} más</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
