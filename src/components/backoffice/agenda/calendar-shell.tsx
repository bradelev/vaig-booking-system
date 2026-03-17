"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { moveBooking } from "@/actions/citas";
import {
  AgendaEvent,
  Professional,
  Client,
  Service,
  CalendarView,
  GCAL_COLOR_MAP,
  PROFESSIONAL_DOT_COLORS,
  PROFESSIONAL_COLORS_FALLBACK,
  TZ,
  getMondayOfWeek,
  formatWeekLabel,
  toDateStr,
} from "./agenda-types";
import WeekView from "./week-view";
import FourDayView from "./four-day-view";
import DayView from "./day-view";
import MonthView from "./month-view";
import CreateBookingModal from "./create-booking-modal";
import EventPopover from "./event-popover";

interface CalendarShellProps {
  events: AgendaEvent[];
  professionals: Professional[];
  clients: Client[];
  services: Service[];
  initialWeek: string;
  initialView: CalendarView;
  initialProfId?: string;
}

const VIEW_LABELS: Record<CalendarView, string> = {
  week:   "Semana",
  "4days": "4 días",
  day:    "Día",
  month:  "Mes",
};

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: TZ });
}

function format4DayLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 3);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("es-AR", { ...opts, timeZone: TZ })} – ${end.toLocaleDateString("es-AR", { ...opts, timeZone: TZ })}`;
}

export default function CalendarShell({
  events,
  professionals,
  clients,
  services,
  initialWeek,
  initialView,
  initialProfId,
}: CalendarShellProps) {
  const router = useRouter();

  const [view, setView] = useState<CalendarView>(initialView);
  const [currentDate, setCurrentDate] = useState<Date>(() => getMondayOfWeek(initialWeek));
  const [selectedProfId, setSelectedProfId] = useState<string | undefined>(initialProfId);
  const [createSlot, setCreateSlot] = useState<{ date: Date; hour: number; minute: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null);

  function syncUrl(newDate: Date, newView: CalendarView, profId?: string) {
    const params = new URLSearchParams();
    params.set("semana", toDateStr(newDate));
    params.set("vista", newView);
    if (profId) params.set("profesional", profId);
    router.replace(`/backoffice/agenda?${params.toString()}`, { scroll: false });
  }

  function handleViewChange(v: CalendarView) {
    setView(v);
    syncUrl(currentDate, v, selectedProfId);
  }

  function navigate(direction: -1 | 1) {
    const newDate = new Date(currentDate);
    if (view === "week") {
      newDate.setDate(currentDate.getDate() + direction * 7);
    } else if (view === "4days") {
      newDate.setDate(currentDate.getDate() + direction * 4);
    } else if (view === "day") {
      newDate.setDate(currentDate.getDate() + direction);
    } else {
      newDate.setMonth(currentDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
    syncUrl(newDate, view, selectedProfId);
  }

  function goToToday() {
    const today = new Date();
    const target = view === "week" ? getMondayOfWeek(toDateStr(today)) : today;
    setCurrentDate(target);
    syncUrl(target, view, selectedProfId);
  }

  function handleProfFilter(profId?: string) {
    setSelectedProfId(profId);
    syncUrl(currentDate, view, profId);
  }

  function filterEvents(allEvents: AgendaEvent[]): AgendaEvent[] {
    if (!selectedProfId) return allEvents;
    const prof = professionals.find((p) => p.id === selectedProfId);
    if (!prof) return allEvents;
    return allEvents.filter((e) => {
      if (e.source === "booking") return e.professionalName === prof.name;
      if (e.gcalColorId && GCAL_COLOR_MAP[e.gcalColorId]) {
        return GCAL_COLOR_MAP[e.gcalColorId].name === prof.name;
      }
      return false;
    });
  }

  const filteredEvents = filterEvents(events);

  // Navigation label
  let navLabel = "";
  if (view === "week") {
    navLabel = formatWeekLabel(getMondayOfWeek(toDateStr(currentDate)));
  } else if (view === "4days") {
    navLabel = format4DayLabel(currentDate);
  } else if (view === "day") {
    navLabel = currentDate.toLocaleDateString("es-AR", {
      weekday: "long", day: "numeric", month: "long", timeZone: TZ,
    });
  } else {
    navLabel = getMonthLabel(currentDate);
  }

  function handleSlotClick(date: Date, hour: number, minute: number) {
    setSelectedEvent(null);
    setPopoverAnchor(null);
    setCreateSlot({ date, hour, minute });
  }

  function handleMonthDayClick(day: Date) {
    setCurrentDate(day);
    setView("day");
    syncUrl(day, "day", selectedProfId);
  }

  function handleEventClick(event: AgendaEvent) {
    const mouseX = (window as Window & { __lastMouseX?: number }).__lastMouseX ?? 400;
    const mouseY = (window as Window & { __lastMouseY?: number }).__lastMouseY ?? 300;
    setSelectedEvent(event);
    setPopoverAnchor({ x: mouseX, y: mouseY });
  }

  const handleEventDrop = useCallback(
    async (eventId: string, newScheduledAt: string) => {
      await moveBooking(eventId, newScheduledAt);
      router.refresh();
    },
    [router]
  );

  const monday = getMondayOfWeek(toDateStr(currentDate));

  return (
    <div
      className="flex flex-col gap-3 h-full min-h-0"
      onMouseMove={(e) => {
        (window as Window & { __lastMouseX?: number }).__lastMouseX = e.clientX;
        (window as Window & { __lastMouseY?: number }).__lastMouseY = e.clientY;
      }}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center gap-1">
            {(["week", "4days", "day", "month"] as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleViewChange(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ←
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Hoy
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">
              {navLabel}
            </span>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              →
            </button>
          </div>

          {/* Professional filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => handleProfFilter(undefined)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                !selectedProfId
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Todos
            </button>
            {professionals.map((p) => {
              const dotColor = PROFESSIONAL_DOT_COLORS[p.name] ?? PROFESSIONAL_COLORS_FALLBACK.border;
              const isActive = selectedProfId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProfFilter(p.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${isActive ? "bg-white" : dotColor}`} />
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {view === "week" && (
          <WeekView
            monday={monday}
            events={filteredEvents}
            onSlotClick={handleSlotClick}
            onEventDrop={handleEventDrop}
            onEventClick={handleEventClick}
          />
        )}
        {view === "4days" && (
          <FourDayView
            startDay={currentDate}
            events={filteredEvents}
            onSlotClick={handleSlotClick}
            onEventDrop={handleEventDrop}
            onEventClick={handleEventClick}
          />
        )}
        {view === "day" && (
          <DayView
            day={currentDate}
            events={filteredEvents}
            onSlotClick={handleSlotClick}
            onEventDrop={handleEventDrop}
            onEventClick={handleEventClick}
          />
        )}
        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            events={filteredEvents}
            onDayClick={handleMonthDayClick}
          />
        )}
      </div>

      {/* Event popover */}
      {selectedEvent && popoverAnchor && (
        <EventPopover
          event={selectedEvent}
          anchor={popoverAnchor}
          onClose={() => {
            setSelectedEvent(null);
            setPopoverAnchor(null);
          }}
        />
      )}

      {/* Create booking modal */}
      {createSlot && (
        <CreateBookingModal
          slot={createSlot}
          clients={clients}
          services={services}
          professionals={professionals}
          onClose={() => setCreateSlot(null)}
        />
      )}
    </div>
  );
}
