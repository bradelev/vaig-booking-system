import { type ClassValue, clsx } from "clsx";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = LOCAL_TIMEZONE;

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  deposit_paid: "Seña pagada",
  confirmed: "Confirmada",
  realized: "Realizada",
  cancelled: "Cancelada",
  no_show: "No se presentó",
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  deposit_paid: "border-blue-200 bg-blue-50 text-blue-800",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  realized: "border-gray-200 bg-gray-50 text-gray-700",
  cancelled: "border-red-200 bg-red-50 text-red-800",
  no_show: "border-orange-200 bg-orange-50 text-orange-800",
};
