"use client";

import { useEffect, useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AgendaEvent, GCAL_COLOR_MAP, formatTimeRange } from "./agenda-types";
import { updateBookingStatus } from "@/actions/citas";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from "@/lib/utils";

interface EventPopoverProps {
  event: AgendaEvent;
  anchor: { x: number; y: number };
  onClose: () => void;
}

const BOOKING_STATUSES = ["pending", "deposit_paid", "confirmed", "realized", "no_show"] as const;

const SOURCE_LABELS: Record<string, string> = {
  booking: "Reserva",
  gcal: "Google Calendar",
  koobing: "Koobing",
};

export default function EventPopover({ event, anchor, onClose }: EventPopoverProps) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(event.status);

  // Close on click outside or Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // Position: keep within viewport
  const POPOVER_W = 340;
  // Header (~72px) + scrollable body (capped at 60vh) + footer (~52px).
  // Use a conservative estimate so the popover stays within the viewport on short screens.
  const POPOVER_H = 520;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(anchor.x + 8, vw - POPOVER_W - 12);
  const top = Math.min(anchor.y, vh - POPOVER_H - 12);

  function handleStatusChange(newStatus: string) {
    setLocalStatus(newStatus);
    startTransition(async () => {
      await updateBookingStatus(event.id, newStatus);
      router.refresh();
    });
  }

  const timeRange = formatTimeRange(event.scheduled_at, event.end_at);

  // Determine header color accent
  let accentClass = "bg-gray-100 border-gray-300";
  if (event.source === "gcal" && event.gcalColorId && GCAL_COLOR_MAP[event.gcalColorId]) {
    accentClass = GCAL_COLOR_MAP[event.gcalColorId].classes;
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[340px] rounded-xl border border-gray-200 bg-white shadow-xl"
      style={{ left, top }}
    >
      {/* Header */}
      <div className={`rounded-t-xl border-b px-4 py-3 ${accentClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words font-semibold text-sm">{event.clientName}</p>
            {event.serviceName && (
              <p className="break-words text-xs opacity-75">{event.serviceName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5 max-h-[60vh] overflow-y-auto">
        {/* Time + duration */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
          <span>
            {timeRange}
            {event.durationMinutes && (
              <span className="ml-1.5 text-gray-400">· {event.durationMinutes} min</span>
            )}
          </span>
        </div>

        {/* Professional */}
        {event.professionalName && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span>{event.professionalName}</span>
          </div>
        )}

        {/* Phone */}
        {event.clientPhone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <a href={`tel:${event.clientPhone}`} className="hover:underline">
              {event.clientPhone}
            </a>
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <svg className="h-4 w-4 shrink-0 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <span className="whitespace-pre-wrap">{event.notes}</span>
          </div>
        )}

        {/* Source badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            {SOURCE_LABELS[event.source] ?? event.source}
          </span>
        </div>

        {/* Status (only for bookings) */}
        {event.source === "booking" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Estado</label>
            <select
              value={localStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isPending}
              className={`w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-gray-300 ${BOOKING_STATUS_COLORS[localStatus] ?? "bg-gray-100 text-gray-800"}`}
            >
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BOOKING_STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Footer actions (only for bookings) */}
      {event.source === "booking" && (
        <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5">
          <Link
            href={`/backoffice/citas/${event.id}/editar`}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Editar
          </Link>
          <Link
            href={`/backoffice/citas/${event.id}/cancelar`}
            className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      )}
    </div>
  );
}
