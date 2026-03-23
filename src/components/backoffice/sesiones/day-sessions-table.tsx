"use client";

import { useState } from "react";
import ConfirmBookingModal, { BookingToConfirm } from "./confirm-booking-modal";

interface SessionRow {
  id: string;
  source: "backoffice" | "system";
  clientName: string;
  tipoServicio: string;
  descripcion?: string;
  operadora?: string;
  montoCobrado?: number;
  metodoPago?: string;
  clientSource?: string;
  time?: string;
  // For pending bookings
  isPendingBooking?: boolean;
  bookingData?: BookingToConfirm;
}

interface DaySessionsTableProps {
  sessions: SessionRow[];
}

function formatCurrency(n?: number): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

export default function DaySessionsTable({ sessions }: DaySessionsTableProps) {
  const [confirmBooking, setConfirmBooking] = useState<BookingToConfirm | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
        No hay sesiones para este día
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="pb-2 pr-4">Hora</th>
              <th className="pb-2 pr-4">Cliente</th>
              <th className="pb-2 pr-4">Servicio</th>
              <th className="pb-2 pr-4">Operadora</th>
              <th className="pb-2 pr-4">Cobrado</th>
              <th className="pb-2 pr-4">Método</th>
              <th className="pb-2 pr-4">Origen</th>
              <th className="pb-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map((row) => (
              <tr
                key={row.id}
                className={row.isPendingBooking ? "bg-amber-50" : ""}
              >
                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{row.time ?? "—"}</td>
                <td className="py-2 pr-4 font-medium text-gray-900">{row.clientName}</td>
                <td className="py-2 pr-4 text-gray-700">
                  <div>{row.tipoServicio}</div>
                  {row.descripcion && (
                    <div className="text-xs text-gray-400">{row.descripcion}</div>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-600">{row.operadora ?? "—"}</td>
                <td className="py-2 pr-4 text-gray-700">{formatCurrency(row.montoCobrado)}</td>
                <td className="py-2 pr-4 text-gray-600">
                  {row.metodoPago?.replace(/_/g, " ") ?? "—"}
                </td>
                <td className="py-2 pr-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.source === "system"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {row.source === "system" ? "Sistema" : "Backoffice"}
                  </span>
                  {row.clientSource && (
                    <span className="ml-1 text-xs text-gray-400">{row.clientSource}</span>
                  )}
                </td>
                <td className="py-2">
                  {row.isPendingBooking && row.bookingData && (
                    <button
                      onClick={() => setConfirmBooking(row.bookingData!)}
                      className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                    >
                      Confirmar
                    </button>
                  )}
                  {!row.isPendingBooking && row.source === "system" && (
                    <span className="text-xs text-green-600 font-medium">✓ Realizada</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {sessions.map((row) => (
          <div
            key={row.id}
            className={`rounded-lg border p-3 space-y-2 ${
              row.isPendingBooking ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-sm text-gray-900">{row.clientName}</div>
                <div className="text-xs text-gray-500">{row.time ?? ""} · {row.tipoServicio}</div>
                {row.descripcion && <div className="text-xs text-gray-400">{row.descripcion}</div>}
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                row.source === "system"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {row.source === "system" ? "Sistema" : "BO"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span>{formatCurrency(row.montoCobrado)}</span>
              {row.metodoPago && <span>{row.metodoPago.replace(/_/g, " ")}</span>}
              {row.operadora && <span>{row.operadora}</span>}
            </div>
            {row.isPendingBooking && row.bookingData && (
              <button
                onClick={() => setConfirmBooking(row.bookingData!)}
                className="w-full rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
              >
                Confirmar sesión
              </button>
            )}
          </div>
        ))}
      </div>

      <ConfirmBookingModal
        booking={confirmBooking}
        onClose={() => setConfirmBooking(null)}
      />
    </>
  );
}
