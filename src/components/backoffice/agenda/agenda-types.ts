// Types, constants, and helpers for the agenda calendar

export type CalendarView = "week" | "day" | "month";

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
}

export interface Professional {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
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

// Solid background colors by professional name
export const PROFESSIONAL_COLORS: Record<string, { bg: string; border: string }> = {
  "Angel":    { bg: "bg-gray-500",   border: "border-gray-700" },
  "Cynthia":  { bg: "bg-orange-400", border: "border-orange-600" },
  "Iara":     { bg: "bg-blue-500",   border: "border-blue-700" },
  "Lucia":    { bg: "bg-sky-400",    border: "border-sky-600" },
  "Stephany": { bg: "bg-purple-500", border: "border-purple-700" },
  "Joana":    { bg: "bg-green-500",  border: "border-green-700" },
};

export const PROFESSIONAL_COLORS_FALLBACK = { bg: "bg-gray-400", border: "border-gray-600" };

export const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 to 20:00
export const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const TZ = "America/Argentina/Buenos_Aires";

// Grid constants
export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 20;
export const ROWS_PER_HOUR = 12; // 5-min granularity
export const ROW_HEIGHT_PX = 6; // each 5-min slot = 6px → 1hr = 72px

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
