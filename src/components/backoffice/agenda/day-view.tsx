"use client";

import { useEffect, useRef } from "react";
import { AgendaEvent, TZ, GRID_START_HOUR, ROW_HEIGHT_PX, timeToGridRow } from "./agenda-types";
import TimeGrid, { TimeGridHeader } from "./time-grid";

interface DayViewProps {
  day: Date;
  events: AgendaEvent[];
  onSlotClick: (date: Date, hour: number, minute: number) => void;
  onEventDrop: (eventId: string, newScheduledAt: string) => void;
  onEventClick: (event: AgendaEvent) => void;
}

export default function DayView({ day, events, onSlotClick, onEventDrop, onEventClick }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current time on mount
  useEffect(() => {
    const now = new Date();
    const hour = parseInt(
      now.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", hour12: false }),
      10
    );
    const minute = parseInt(
      now.toLocaleTimeString("es-AR", { timeZone: TZ, minute: "2-digit" }),
      10
    );
    const row = timeToGridRow(Math.max(hour - 1, GRID_START_HOUR), minute);
    const scrollTop = (row - 1) * ROW_HEIGHT_PX;
    if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
  }, []);

  return (
    <div className="flex-1 flex flex-col rounded-lg border bg-white shadow-sm min-h-0 overflow-hidden">
      {/* Fixed header */}
      <TimeGridHeader days={[day]} />
      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <TimeGrid
          days={[day]}
          events={events}
          onSlotClick={onSlotClick}
          onEventDrop={onEventDrop}
          onEventClick={onEventClick}
        />
      </div>
    </div>
  );
}
