import { type ReactNode } from "react";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from "@/lib/utils";

const STATUS_ICONS: Record<string, ReactNode> = {
  pending: (
    <svg aria-hidden="true" className="shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  deposit_paid: (
    <svg aria-hidden="true" className="shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 3v1m0 4v1M4.5 5.5S4.5 4.5 6 4.5s1.5 1 1.5 1.5S6.5 7 6 7s-1.5.5-1.5 1.5S5 9.5 6 9.5s1.5-.5 1.5-1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  ),
  confirmed: (
    <svg aria-hidden="true" className="shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  realized: (
    <svg aria-hidden="true" className="shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 6l2 2 3-3M5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  cancelled: (
    <svg aria-hidden="true" className="shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 4l4 4M8 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  no_show: (
    <svg aria-hidden="true" className="shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 1l2 2M11 1L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = BOOKING_STATUS_LABELS[status] ?? status;
  const color = BOOKING_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800";
  const icon = STATUS_ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {icon}
      {label}
    </span>
  );
}
