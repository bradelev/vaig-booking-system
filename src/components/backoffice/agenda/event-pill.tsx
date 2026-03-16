"use client";

import Link from "next/link";
import {
  AgendaEvent,
  PROFESSIONAL_COLORS,
  PROFESSIONAL_COLORS_FALLBACK,
  GCAL_COLOR_MAP,
  getLocalTime,
  timeToGridRow,
  durationToRows,
  GRID_START_HOUR,
  GRID_END_HOUR,
  ROWS_PER_HOUR,
} from "./agenda-types";

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-green-400",
  pending:   "bg-yellow-400",
  realized:  "bg-blue-400",
  no_show:   "bg-red-400",
};

interface EventPillProps {
  event: AgendaEvent;
  dayCol: number; // 1-indexed column within the time grid (after the hour label col)
  onDragStart?: (eventId: string) => void;
}

export default function EventPill({ event, dayCol, onDragStart }: EventPillProps) {
  const { hour: startHour, minute: startMinute } = getLocalTime(event.scheduled_at);
  const { hour: endHour, minute: endMinute } = getLocalTime(event.end_at);

  // Clamp to grid bounds
  const clampedStartHour = Math.max(startHour, GRID_START_HOUR);
  const clampedStartMinute = startHour < GRID_START_HOUR ? 0 : startMinute;
  const clampedEndHour = Math.min(endHour, GRID_END_HOUR);
  const clampedEndMinute = endHour > GRID_END_HOUR ? 0 : endMinute;

  const startRow = timeToGridRow(clampedStartHour, clampedStartMinute);
  const durationMinutes =
    (clampedEndHour * 60 + clampedEndMinute) - (clampedStartHour * 60 + clampedStartMinute);
  const rowSpan = durationToRows(durationMinutes > 0 ? durationMinutes : 30);
  const endRow = startRow + rowSpan;

  // Out of grid entirely
  if (startRow > (GRID_END_HOUR - GRID_START_HOUR) * ROWS_PER_HOUR || endRow < 1) return null;

  // Color
  let bgClass: string;
  let borderClass: string;

  if (event.source === "booking" && event.professionalName) {
    const colors = PROFESSIONAL_COLORS[event.professionalName] ?? PROFESSIONAL_COLORS_FALLBACK;
    bgClass = colors.bg;
    borderClass = colors.border;
  } else if (event.source === "gcal" && event.gcalColorId && GCAL_COLOR_MAP[event.gcalColorId]) {
    bgClass = GCAL_COLOR_MAP[event.gcalColorId].solidBg;
    borderClass = "border-black/20";
  } else {
    bgClass = PROFESSIONAL_COLORS_FALLBACK.bg;
    borderClass = PROFESSIONAL_COLORS_FALLBACK.border;
  }

  const dotColor = STATUS_DOT[event.status] ?? "bg-gray-300";
  const isDraggable = event.source === "booking";

  const content = (
    <div className="h-full overflow-hidden px-1.5 py-0.5">
      <div className="flex items-center gap-1 min-w-0">
        {event.source === "booking" && (
          <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dotColor}`} />
        )}
        <span className="truncate text-[11px] font-semibold leading-tight text-white">
          {event.clientName}
        </span>
      </div>
      {rowSpan >= 4 && event.professionalName && (
        <div className="truncate text-[10px] leading-tight text-white/80">
          {event.professionalName}
        </div>
      )}
      {rowSpan >= 6 && event.serviceName && (
        <div className="truncate text-[10px] leading-tight text-white/70">
          {event.serviceName}
        </div>
      )}
    </div>
  );

  const style: React.CSSProperties = {
    gridRow: `${startRow} / ${endRow}`,
    gridColumn: `${dayCol + 1}`, // +1 because col 1 is the hour label
    zIndex: 10,
    minHeight: "12px",
  };

  const className = `relative rounded-md border-l-[3px] ${bgClass} ${borderClass} overflow-hidden cursor-pointer hover:brightness-110 transition-all select-none`;

  if (event.source === "booking") {
    return (
      <Link
        href={`/backoffice/citas/${event.id}/editar`}
        style={style}
        className={className}
        draggable={isDraggable}
        onDragStart={isDraggable && onDragStart ? (e) => {
          e.dataTransfer.setData("text/plain", event.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart(event.id);
        } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </Link>
    );
  }

  return (
    <div style={style} className={className}>
      {content}
    </div>
  );
}
