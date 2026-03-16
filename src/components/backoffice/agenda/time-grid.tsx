"use client";

import { useRef } from "react";
import {
  AgendaEvent,
  HOURS,
  DAYS,
  TZ,
  GRID_START_HOUR,
  GRID_END_HOUR,
  ROWS_PER_HOUR,
  ROW_HEIGHT_PX,
  getLocalDate,
  timeToGridRow,
  toDateStr,
} from "./agenda-types";
import EventPill from "./event-pill";
import NowLine from "./now-line";

interface TimeGridProps {
  days: Date[];
  events: AgendaEvent[];
  onSlotClick: (date: Date, hour: number, minute: number) => void;
  onEventDrop: (eventId: string, newScheduledAt: string) => void;
}

const TOTAL_ROWS = (GRID_END_HOUR - GRID_START_HOUR) * ROWS_PER_HOUR;

export default function TimeGrid({ days, events, onSlotClick, onEventDrop }: TimeGridProps) {
  const dayCount = days.length;
  const containerRef = useRef<HTMLDivElement>(null);

  function getEventsForDay(day: Date): AgendaEvent[] {
    const dateStr = toDateStr(day);
    return events.filter((e) => getLocalDate(e.scheduled_at) === dateStr);
  }

  function handleCellClick(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalHeight = TOTAL_ROWS * ROW_HEIGHT_PX;
    const fraction = Math.max(0, Math.min(1, y / totalHeight));
    const totalMinutes = Math.floor(fraction * (GRID_END_HOUR - GRID_START_HOUR) * 60);
    const hour = GRID_START_HOUR + Math.floor(totalMinutes / 60);
    const minute = Math.floor((totalMinutes % 60) / 5) * 5;
    onSlotClick(day, hour, minute);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(day: Date, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain");
    if (!eventId) return;

    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalHeight = TOTAL_ROWS * ROW_HEIGHT_PX;
    const fraction = Math.max(0, Math.min(1, y / totalHeight));
    const totalMinutes = Math.floor(fraction * (GRID_END_HOUR - GRID_START_HOUR) * 60);
    const hour = GRID_START_HOUR + Math.floor(totalMinutes / 60);
    const minute = Math.floor((totalMinutes % 60) / 5) * 5;

    // Build ISO string for new scheduled_at
    const dayStr = toDateStr(day);
    const paddedHour = String(hour).padStart(2, "0");
    const paddedMin = String(minute).padStart(2, "0");
    // Use local time in TZ and convert to UTC-3 offset (Argentina doesn't observe DST)
    const newScheduledAt = `${dayStr}T${paddedHour}:${paddedMin}:00-03:00`;
    onEventDrop(eventId, newScheduledAt);
  }

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

  return (
    <div ref={containerRef} className="overflow-auto">
      <div className="min-w-[600px]">
        {/* Day headers */}
        <div
          className="sticky top-0 z-30 bg-white border-b border-gray-200"
          style={{
            display: "grid",
            gridTemplateColumns: `60px repeat(${dayCount}, minmax(100px, 1fr))`,
          }}
        >
          <div className="h-12" /> {/* hour label spacer */}
          {days.map((day, i) => {
            const dateStr = toDateStr(day);
            const isToday = dateStr === today;
            const dayLabel = DAYS[(day.getDay() + 6) % 7]; // Mon=0 in our DAYS array
            return (
              <div
                key={i}
                className={`flex flex-col items-center justify-center h-12 text-xs font-medium border-l border-gray-200 ${
                  isToday ? "bg-gray-900 text-white" : "text-gray-500"
                }`}
              >
                <span>{dayLabel}</span>
                <span className={`text-base font-bold ${isToday ? "text-white" : "text-gray-900"}`}>
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Grid body */}
        <div
          className="relative"
          style={{
            display: "grid",
            gridTemplateColumns: `60px repeat(${dayCount}, minmax(100px, 1fr))`,
            gridTemplateRows: `repeat(${TOTAL_ROWS}, ${ROW_HEIGHT_PX}px)`,
          }}
        >
          {/* Hour labels + horizontal lines */}
          {HOURS.map((hour) => {
            const row = timeToGridRow(hour, 0);
            return (
              <div
                key={hour}
                className="col-start-1 flex items-start justify-end pr-2 text-[10px] text-gray-400 border-t border-gray-100"
                style={{ gridRow: `${row} / ${row + ROWS_PER_HOUR}` }}
              >
                <span className="-translate-y-2">{String(hour).padStart(2, "0")}:00</span>
              </div>
            );
          })}

          {/* Half-hour faint lines */}
          {HOURS.map((hour) => {
            const row = timeToGridRow(hour, 30);
            return (
              <div
                key={`half-${hour}`}
                className="col-start-2 border-t border-dashed border-gray-100 pointer-events-none"
                style={{
                  gridRow: `${row} / ${row + 1}`,
                  gridColumn: `2 / ${dayCount + 2}`,
                }}
              />
            );
          })}

          {/* Day columns: click/drop zones + events */}
          {days.map((day, dayIdx) => {
            const colStart = dayIdx + 2; // +2 because col 1 is hour label

            return (
              <div
                key={dayIdx}
                className="border-l border-gray-200 hover:bg-gray-50/30 cursor-pointer relative"
                style={{
                  gridColumn: `${colStart} / ${colStart + 1}`,
                  gridRow: `1 / ${TOTAL_ROWS + 1}`,
                }}
                onClick={(e) => handleCellClick(day, e)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(day, e)}
              />
            );
          })}

          {/* Event pills */}
          {days.map((day, dayIdx) => {
            const dayEvents = getEventsForDay(day);
            return dayEvents.map((event) => (
              <EventPill
                key={event.id}
                event={event}
                dayCol={dayIdx + 1}
                onDragStart={undefined}
              />
            ));
          })}

          {/* Now line */}
          <NowLine dayCount={dayCount} />
        </div>
      </div>
    </div>
  );
}
