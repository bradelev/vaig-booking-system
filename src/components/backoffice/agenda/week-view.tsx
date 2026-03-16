"use client";

import { useEffect, useRef } from "react";
import { AgendaEvent, TZ, GRID_START_HOUR, ROW_HEIGHT_PX, timeToGridRow } from "./agenda-types";
import TimeGrid from "./time-grid";

interface WeekViewProps {
  monday: Date;
  events: AgendaEvent[];
  onSlotClick: (date: Date, hour: number, minute: number) => void;
  onEventDrop: (eventId: string, newScheduledAt: string) => void;
}

export default function WeekView({ monday, events, onSlotClick, onEventDrop }: WeekViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

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
    if (containerRef.current) {
      containerRef.current.scrollTop = scrollTop;
    }
  }, []);

  return (
    <div ref={containerRef} className="overflow-auto flex-1 rounded-lg border bg-white shadow-sm">
      <TimeGrid
        days={days}
        events={events}
        onSlotClick={onSlotClick}
        onEventDrop={onEventDrop}
      />
    </div>
  );
}
