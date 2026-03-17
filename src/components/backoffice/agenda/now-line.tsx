"use client";

import { useState, useEffect, useCallback } from "react";
import { TZ, GRID_START_HOUR, GRID_END_HOUR, ROW_HEIGHT_PX, ROWS_PER_HOUR, timeToGridRow } from "./agenda-types";

interface NowLineProps {
  dayCount: number;
}

function calcTopPx(): number | null {
  const now = new Date();
  const hour = parseInt(
    now.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", hour12: false }),
    10
  );
  const minute = parseInt(
    now.toLocaleTimeString("es-AR", { timeZone: TZ, minute: "2-digit" }),
    10
  );
  if (hour < GRID_START_HOUR || hour >= GRID_END_HOUR) return null;
  const row = timeToGridRow(hour, minute);
  const totalRows = (GRID_END_HOUR - GRID_START_HOUR) * ROWS_PER_HOUR;
  if (row < 1 || row > totalRows) return null;
  return (row - 1) * ROW_HEIGHT_PX;
}

export default function NowLine({ dayCount }: NowLineProps) {
  const [topPx, setTopPx] = useState<number | null>(calcTopPx);

  const tick = useCallback(() => {
    setTopPx(calcTopPx());
  }, []);

  useEffect(() => {
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [tick]);

  if (topPx === null) return null;

  // Span the hour label (60px) + all day columns
  // gridColumn 1 = hour label, columns 2..dayCount+1 = days
  return (
    <div
      className="pointer-events-none z-20 flex items-center"
      style={{
        position: "absolute",
        top: topPx,
        left: 0,
        right: 0,
        gridColumn: `1 / ${dayCount + 2}`,
      }}
    >
      <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-red-500 ml-[54px]" />
      <span className="flex-1 border-t-2 border-red-500" />
    </div>
  );
}
