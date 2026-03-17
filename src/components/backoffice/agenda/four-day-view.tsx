"use client";

import { useEffect, useRef } from "react";
import { AgendaEvent, TZ, GRID_START_HOUR, ROW_HEIGHT_PX, timeToGridRow } from "./agenda-types";
import TimeGrid, { TimeGridHeader } from "./time-grid";

interface FourDayViewProps {
  startDay: Date;
  events: AgendaEvent[];
  onSlotClick: (date: Date, hour: number, minute: number) => void;
  onEventDrop: (eventId: string, newScheduledAt: string) => void;
  onEventClick: (event: AgendaEvent) => void;
}

export default function FourDayView({ startDay, events, onSlotClick, onEventDrop, onEventClick }: FourDayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    return d;
  });

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
      <TimeGridHeader days={days} />
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <TimeGrid
          days={days}
          events={events}
          onSlotClick={onSlotClick}
          onEventDrop={onEventDrop}
          onEventClick={onEventClick}
        />
      </div>
    </div>
  );
}
