// Types, constants, and helpers for the agenda calendar
import { LOCAL_TIMEZONE } from "@/lib/timezone";

export type CalendarView = "week" | "4days" | "day" | "month";

export interface AgendaEvent {
  id: string;
  scheduled_at: string;
  end_at: string;
  status: string;
  source: "booking" | "gcal";
  clientName: string;
  serviceName: string;
  professionalName?: string;
  gcalColorId?: string;
  // Extended fields for popover
  client_id?: string;
  service_id?: string;
  professional_id?: string;
  notes?: string;
  clientPhone?: string;
  durationMinutes?: number;
}

export interface Professional {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
}

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
}

// GCal colorId → { professional name, solid bg color class }
export const GCAL_COLOR_MAP: Record<string, { name: string; classes: string; solidBg: string }> = {
  "8":  { name: "Angel",    classes: "border-gray-400 bg-gray-100 text-gray-800",         solidBg: "bg-gray-500" },
  "6":  { name: "Cynthia",  classes: "border-orange-400 bg-orange-50 text-orange-800",    solidBg: "bg-orange-400" },
  "9":  { name: "Iara",     classes: "border-blue-500 bg-blue-50 text-blue-800",          solidBg: "bg-blue-500" },
  "7":  { name: "Lucia",    classes: "border-sky-400 bg-sky-50 text-sky-800",             solidBg: "bg-sky-400" },
  "3":  { name: "Stephany", classes: "border-purple-400 bg-purple-50 text-purple-800",   solidBg: "bg-purple-500" },
  "2":  { name: "Joana",    classes: "border-green-500 bg-green-50 text-green-800",       solidBg: "bg-green-500" },
  "10": { name: "Joana",    classes: "border-green-400 bg-green-50 text-green-800",       solidBg: "bg-green-500" },
};

// Pastel colors by professional name (GCal style: light bg, dark text, colored border)
export const PROFESSIONAL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Angel":    { bg: "bg-gray-200",    text: "text-gray-800",    border: "border-gray-400" },
  "Cynthia":  { bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-400" },
  "Iara":     { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-400" },
  "Lucia":    { bg: "bg-sky-100",     text: "text-sky-800",     border: "border-sky-400" },
  "Stephany": { bg: "bg-purple-100",  text: "text-purple-800",  border: "border-purple-400" },
  "Joana":    { bg: "bg-green-100",   text: "text-green-800",   border: "border-green-400" },
};

export const PROFESSIONAL_COLORS_FALLBACK = { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-400" };

// Solid dot colors for the month view and filter chips
export const PROFESSIONAL_DOT_COLORS: Record<string, string> = {
  "Angel":    "bg-gray-500",
  "Cynthia":  "bg-orange-400",
  "Iara":     "bg-blue-500",
  "Lucia":    "bg-sky-400",
  "Stephany": "bg-purple-500",
  "Joana":    "bg-green-500",
};

export const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 to 23:00
export const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const TZ = LOCAL_TIMEZONE;

// Grid constants
export const GRID_START_HOUR = 0;
export const GRID_END_HOUR = 24;
export const ROWS_PER_HOUR = 12; // 5-min granularity
export const ROW_HEIGHT_PX = 10; // each 5-min slot = 10px → 1hr = 120px (GCal-like)

/**
 * Returns { hour, minute } for an ISO timestamp in Argentina TZ
 */
export function getLocalTime(isoString: string): { hour: number; minute: number } {
  const dt = new Date(isoString);
  const hour = parseInt(
    dt.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", hour12: false }),
    10
  );
  const minute = dt.toLocaleString("es-AR", { timeZone: TZ, minute: "2-digit" });
  return { hour, minute: parseInt(minute, 10) };
}

/**
 * Returns local date string (YYYY-MM-DD) for an ISO timestamp in Argentina TZ
 */
export function getLocalDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("sv-SE", { timeZone: TZ });
}

/**
 * Returns grid row (1-indexed) for a given hour and minute.
 * Row 1 = 08:00, each row = 5 minutes
 */
export function timeToGridRow(hour: number, minute: number): number {
  return (hour - GRID_START_HOUR) * ROWS_PER_HOUR + Math.floor(minute / 5) + 1;
}

/**
 * Returns duration in 5-min slots (minimum 2)
 */
export function durationToRows(durationMinutes: number): number {
  return Math.max(2, Math.ceil(durationMinutes / 5));
}

export function toDateStr(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function getMondayOfWeek(dateStr: string): Date {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

export function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString("es-AR", { ...opts, timeZone: TZ })} – ${sunday.toLocaleDateString("es-AR", { ...opts, timeZone: TZ })}`;
}

/**
 * Returns formatted time range string like "10:30 – 11:15"
 */
export function formatTimeRange(scheduled_at: string, end_at: string): string {
  const fmt = (iso: string) => {
    const { hour, minute } = getLocalTime(iso);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };
  return `${fmt(scheduled_at)} – ${fmt(end_at)}`;
}

/**
 * Returns formatted start time like "10:30"
 */
export function formatStartTime(scheduled_at: string): string {
  const { hour, minute } = getLocalTime(scheduled_at);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
