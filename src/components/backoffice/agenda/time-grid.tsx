"use client";

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
  getLocalTime,
  timeToGridRow,
  durationToRows,
  toDateStr,
} from "./agenda-types";
import EventPill from "./event-pill";
import NowLine from "./now-line";

const TOTAL_ROWS = (GRID_END_HOUR - GRID_START_HOUR) * ROWS_PER_HOUR;
const TOTAL_HEIGHT_PX = TOTAL_ROWS * ROW_HEIGHT_PX;

export interface PositionedEvent {
  event: AgendaEvent;
  col: number;
  totalCols: number;
  topPx: number;
  heightPx: number;
}

function assignOverlapColumns(dayEvents: AgendaEvent[]): PositionedEvent[] {
  type EventWithRows = { event: AgendaEvent; startRow: number; endRow: number };

  const sorted = [...dayEvents].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  const withRows: EventWithRows[] = sorted.map((e) => {
    const { hour: sh, minute: sm } = getLocalTime(e.scheduled_at);
    const { hour: eh, minute: em } = getLocalTime(e.end_at);
    const csh = Math.max(sh, GRID_START_HOUR);
    const csm = sh < GRID_START_HOUR ? 0 : sm;
    const ceh = Math.min(eh, GRID_END_HOUR);
    const cem = eh > GRID_END_HOUR ? 0 : em;
    const startRow = timeToGridRow(csh, csm);
    const durMin = (ceh * 60 + cem) - (csh * 60 + csm);
    const rowSpan = durationToRows(durMin > 0 ? durMin : 30);
    return { event: e, startRow, endRow: startRow + rowSpan };
  });

  const positioned: PositionedEvent[] = withRows.map((e) => ({
    event: e.event,
    col: 0,
    totalCols: 1,
    topPx: (e.startRow - 1) * ROW_HEIGHT_PX,
    heightPx: (e.endRow - e.startRow) * ROW_HEIGHT_PX,
  }));

  const colEndRow: number[] = [];
  for (let i = 0; i < withRows.length; i++) {
    const ev = withRows[i];
    let assigned = -1;
    for (let c = 0; c < colEndRow.length; c++) {
      if (ev.startRow >= colEndRow[c]) { assigned = c; break; }
    }
    if (assigned === -1) { assigned = colEndRow.length; colEndRow.push(0); }
    colEndRow[assigned] = ev.endRow;
    positioned[i].col = assigned;
  }

  for (let i = 0; i < positioned.length; i++) {
    let maxCol = positioned[i].col;
    const a = withRows[i];
    for (let j = 0; j < positioned.length; j++) {
      if (i === j) continue;
      const b = withRows[j];
      if (a.startRow < b.endRow && b.startRow < a.endRow && positioned[j].col > maxCol) {
        maxCol = positioned[j].col;
      }
    }
    positioned[i].totalCols = maxCol + 1;
  }

  return positioned;
}

// ─── Header (rendered outside the scroll container) ────────────────────────

interface TimeGridHeaderProps {
  days: Date[];
}

export function TimeGridHeader({ days }: TimeGridHeaderProps) {
  const dayCount = days.length;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

  return (
    <div
      className="bg-white border-b border-gray-200 min-w-[600px]"
      style={{
        display: "grid",
        gridTemplateColumns: `60px repeat(${dayCount}, minmax(100px, 1fr))`,
      }}
    >
      <div className="h-12" /> {/* spacer aligns with hour-label column */}
      {days.map((day, i) => {
        const dateStr = toDateStr(day);
        const isToday = dateStr === today;
        const dayLabel = DAYS[(day.getDay() + 6) % 7];
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
  );
}

// ─── Body (rendered inside the scroll container) ────────────────────────────

interface TimeGridProps {
  days: Date[];
  events: AgendaEvent[];
  onSlotClick: (date: Date, hour: number, minute: number) => void;
  onEventDrop: (eventId: string, newScheduledAt: string) => void;
  onEventClick: (event: AgendaEvent) => void;
}

export default function TimeGrid({ days, events, onSlotClick, onEventDrop, onEventClick }: TimeGridProps) {
  const dayCount = days.length;

  function getEventsForDay(day: Date): AgendaEvent[] {
    const dateStr = toDateStr(day);
    return events.filter((e) => getLocalDate(e.scheduled_at) === dateStr);
  }

  function handleCellClick(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const fraction = Math.max(0, Math.min(1, y / TOTAL_HEIGHT_PX));
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

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const fraction = Math.max(0, Math.min(1, y / TOTAL_HEIGHT_PX));
    const totalMinutes = Math.floor(fraction * (GRID_END_HOUR - GRID_START_HOUR) * 60);
    const hour = GRID_START_HOUR + Math.floor(totalMinutes / 60);
    const minute = Math.floor((totalMinutes % 60) / 5) * 5;

    const dayStr = toDateStr(day);
    const newScheduledAt = `${dayStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`;
    onEventDrop(eventId, newScheduledAt);
  }

  return (
    <div
      className="min-w-[600px] relative"
      style={{
        display: "grid",
        gridTemplateColumns: `60px repeat(${dayCount}, minmax(100px, 1fr))`,
        height: `${TOTAL_HEIGHT_PX}px`,
      }}
    >
      {/* Hour labels */}
      <div className="relative" style={{ gridColumn: 1, gridRow: 1 }}>
        {HOURS.map((hour) => {
          const topPx = (timeToGridRow(hour, 0) - 1) * ROW_HEIGHT_PX;
          return (
            <div
              key={hour}
              className="absolute right-0 flex items-start justify-end pr-2 text-[10px] text-gray-400"
              style={{ top: topPx, width: "60px" }}
            >
              <span className="-translate-y-2">{String(hour).padStart(2, "0")}:00</span>
            </div>
          );
        })}
      </div>

      {/* Day columns */}
      {days.map((day, dayIdx) => {
        const colStart = dayIdx + 2;
        const dayEvents = getEventsForDay(day);
        const positioned = assignOverlapColumns(dayEvents);

        return (
          <div
            key={dayIdx}
            className="relative border-l border-gray-200 hover:bg-gray-50/30 cursor-pointer overflow-hidden"
            style={{ gridColumn: colStart, gridRow: 1, height: `${TOTAL_HEIGHT_PX}px` }}
            onClick={(e) => handleCellClick(day, e)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(day, e)}
          >
            {/* Hour + half-hour lines */}
            {HOURS.map((hour) => (
              <div key={hour}>
                <div
                  className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
                  style={{ top: (timeToGridRow(hour, 0) - 1) * ROW_HEIGHT_PX }}
                />
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-gray-100 pointer-events-none"
                  style={{ top: (timeToGridRow(hour, 30) - 1) * ROW_HEIGHT_PX }}
                />
              </div>
            ))}

            {/* Events */}
            {positioned.map(({ event, col, totalCols, topPx, heightPx }) => (
              <EventPill
                key={event.id}
                event={event}
                topPx={topPx}
                heightPx={heightPx}
                col={col}
                totalCols={totalCols}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        );
      })}

      {/* Now line */}
      <NowLine dayCount={dayCount} />
    </div>
  );
}
