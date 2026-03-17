"use client";

import {
  AgendaEvent,
  PROFESSIONAL_COLORS,
  PROFESSIONAL_COLORS_FALLBACK,
  GCAL_COLOR_MAP,
  formatStartTime,
  formatTimeRange,
} from "./agenda-types";

const STATUS_DOT: Record<string, string> = {
  confirmed:    "bg-green-500",
  pending:      "bg-yellow-500",
  deposit_paid: "bg-blue-500",
  realized:     "bg-gray-500",
  no_show:      "bg-red-500",
};

// Minimum height in px to show extra lines
const MIN_H_TIME = 20;   // show start time
const MIN_H_RANGE = 48;  // show full range
const MIN_H_PROF = 38;   // show professional
const MIN_H_SVC  = 60;   // show service

interface EventPillProps {
  event: AgendaEvent;
  topPx: number;
  heightPx: number;
  col: number;        // 0-indexed overlap column
  totalCols: number;  // total overlap columns for this event's cluster
  onDragStart?: (eventId: string) => void;
  onEventClick: (event: AgendaEvent) => void;
}

export default function EventPill({
  event,
  topPx,
  heightPx,
  col,
  totalCols, // eslint-disable-line @typescript-eslint/no-unused-vars
  onDragStart,
  onEventClick,
}: EventPillProps) {
  // GCal-style partial overlap: each event keeps a generous width and shifts
  // slightly to the right instead of dividing the column equally.
  const OVERLAP_OFFSET_PCT = 15;
  const MIN_WIDTH_PCT = 60;
  const leftPct  = col * OVERLAP_OFFSET_PCT;
  const widthPct = Math.max(MIN_WIDTH_PCT, 100 - leftPct);

  const style: React.CSSProperties = {
    position: "absolute",
    top:    topPx + 1,
    height: Math.max(heightPx - 2, 10),
    left:   `calc(${leftPct}% + 1px)`,
    width:  `calc(${widthPct}% - 2px)`,
    zIndex: 10 + col,
    minHeight: 12,
    boxShadow: col > 0 ? "-2px 0 4px rgba(0,0,0,0.15)" : undefined,
  };

  // Determine color classes
  let containerClass: string;
  let textMutedClass: string;

  if (event.source === "gcal" && event.gcalColorId && GCAL_COLOR_MAP[event.gcalColorId]) {
    containerClass = `rounded-md border-l-[3px] ${GCAL_COLOR_MAP[event.gcalColorId].classes} overflow-hidden cursor-pointer hover:opacity-80 transition-all select-none text-left`;
    textMutedClass = "opacity-70";
  } else {
    const colors = event.source === "booking" && event.professionalName
      ? (PROFESSIONAL_COLORS[event.professionalName] ?? PROFESSIONAL_COLORS_FALLBACK)
      : PROFESSIONAL_COLORS_FALLBACK;
    containerClass = `rounded-md border-l-[3px] ${colors.bg} ${colors.text} ${colors.border} overflow-hidden cursor-pointer hover:opacity-80 transition-all select-none text-left`;
    textMutedClass = "opacity-70";
  }

  const dotColor = STATUS_DOT[event.status] ?? "bg-gray-400";
  const isDraggable = event.source === "booking";
  const h = Math.max(heightPx - 2, 10);

  return (
    <button
      type="button"
      style={style}
      className={containerClass}
      draggable={isDraggable}
      onDragStart={isDraggable && onDragStart ? (e) => {
        e.dataTransfer.setData("text/plain", event.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(event.id);
      } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event);
      }}
    >
      <div className="h-full overflow-hidden px-1.5 py-0.5">
        {/* Client name row */}
        <div className="flex items-center gap-1 min-w-0">
          {event.source === "booking" && (
            <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dotColor}`} />
          )}
          <span className="truncate text-[11px] font-semibold leading-tight">
            {event.clientName}
          </span>
        </div>
        {/* Time */}
        {h >= MIN_H_TIME && (
          <div className={`text-[10px] leading-tight ${textMutedClass}`}>
            {h >= MIN_H_RANGE
              ? formatTimeRange(event.scheduled_at, event.end_at)
              : formatStartTime(event.scheduled_at)}
          </div>
        )}
        {/* Professional */}
        {h >= MIN_H_PROF && event.professionalName && (
          <div className={`truncate text-[10px] leading-tight ${textMutedClass}`}>
            {event.professionalName}
          </div>
        )}
        {/* Service */}
        {h >= MIN_H_SVC && event.serviceName && (
          <div className={`truncate text-[10px] leading-tight ${textMutedClass}`}>
            {event.serviceName}
          </div>
        )}
      </div>
    </button>
  );
}
