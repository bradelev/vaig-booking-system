"use client";

import { useState, useEffect, useCallback } from "react";
import { TZ, GRID_START_HOUR, GRID_END_HOUR, timeToGridRow, ROWS_PER_HOUR } from "./agenda-types";

interface NowLineProps {
  dayCount: number;
}

function calcRow(): number | null {
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
  return timeToGridRow(hour, minute);
}

export default function NowLine({ dayCount }: NowLineProps) {
  const [row, setRow] = useState<number | null>(calcRow);

  const tick = useCallback(() => {
    setRow(calcRow());
  }, []);

  useEffect(() => {
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [tick]);

  if (row === null) return null;

  const totalRows = (GRID_END_HOUR - GRID_START_HOUR) * ROWS_PER_HOUR;
  if (row < 1 || row > totalRows) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
      style={{
        gridRow: `${row} / ${row + 1}`,
        gridColumn: `1 / ${dayCount + 2}`,
      }}
    >
      {/* Red dot */}
      <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-red-500 ml-[54px]" />
      {/* Red line */}
      <span className="flex-1 border-t-2 border-red-500" />
    </div>
  );
}
