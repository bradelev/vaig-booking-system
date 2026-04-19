"use client";

import { useState, useTransition } from "react";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { CheckCircle2, Clock, Send } from "lucide-react";
import { sendReminders, type SendRemindersResult } from "@/actions/recordatorios";
import type { ReminderBooking } from "./page";

const DEFAULT_MESSAGE =
  "Te recordamos tu turno de mañana. Respondé *confirmo* para confirmar o *cancelar* si necesitás cancelarlo.";

interface Props {
  bookings: ReminderBooking[];
  tomorrowLabel: string;
}

export default function RecordatoriosPageClient({ bookings, tomorrowLabel }: Props) {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(bookings.filter((b) => !b.confirmationSentAt).map((b) => b.id))
  );
  const [result, setResult] = useState<SendRemindersResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const allUnsent = bookings.filter((b) => !b.confirmationSentAt);
  const allSelected = allUnsent.length > 0 && allUnsent.every((b) => selectedIds.has(b.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.map((b) => b.id)));
    }
  }

  function handleSend() {
    const ids = Array.from(selectedIds);
    if (!ids.length || !message.trim()) return;
    setResult(null);
    startTransition(async () => {
      const res = await sendReminders(ids, message.trim());
      setResult(res);
      // Deselect all that were sent (optimistic)
      if (res.sent > 0) {
        setSelectedIds(new Set());
      }
    });
  }

  const now = new Date().toLocaleTimeString("es-AR", {
    timeZone: LOCAL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Recordatorios</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Turnos de <span className="font-medium capitalize">{tomorrowLabel}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* LEFT: form + table */}
        <div className="space-y-5">
          {/* Message editor */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Mensaje
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
              placeholder="Escribí el mensaje de recordatorio..."
            />
            <p className="text-xs text-gray-400">
              Se envía usando el template <code>campana_general</code>. El nombre del cliente se agrega automáticamente.
            </p>
          </div>

          {/* Recipients table */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-brand"
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  {selectedIds.size === 0
                    ? "Seleccionar todos"
                    : `${selectedIds.size} seleccionado${selectedIds.size !== 1 ? "s" : ""}`}
                </label>
              </div>
              {bookings.length === 0 && (
                <span className="text-xs text-gray-400">Sin turnos para mañana</span>
              )}
            </div>

            {bookings.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="w-10 px-4 py-2" />
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Cliente</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Teléfono</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Servicio</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Hora</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bookings.map((booking) => (
                        <BookingRow
                          key={booking.id}
                          booking={booking}
                          selected={selectedIds.has(booking.id)}
                          onToggle={() => toggleSelect(booking.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {bookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      selected={selectedIds.has(booking.id)}
                      onToggle={() => toggleSelect(booking.id)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No hay turnos confirmados para mañana.
              </div>
            )}
          </div>

          {/* Result banner */}
          {result && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                result.failed > 0 && result.sent === 0
                  ? "border-red-200 bg-red-50 text-red-700"
                  : result.failed > 0
                  ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              <p className="font-medium">
                {result.sent > 0 ? `✓ ${result.sent} recordatorio${result.sent !== 1 ? "s" : ""} enviado${result.sent !== 1 ? "s" : ""}` : ""}
                {result.failed > 0 ? `${result.sent > 0 ? "  ·  " : ""}${result.failed} fallido${result.failed !== 1 ? "s" : ""}` : ""}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1 list-disc list-inside text-xs space-y-0.5 text-current opacity-80">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {result.errors.length > 5 && <li>y {result.errors.length - 5} más...</li>}
                </ul>
              )}
            </div>
          )}

          {/* Send button */}
          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={isPending || selectedIds.size === 0 || !message.trim()}
              className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              {isPending
                ? "Enviando..."
                : `Enviar recordatorio${selectedIds.size !== 1 ? "s" : ""} (${selectedIds.size})`}
            </button>
          </div>
        </div>

        {/* RIGHT: WhatsApp preview */}
        <div className="md:sticky md:top-6 md:self-start">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Vista previa</p>
          <div
            className="rounded-2xl p-4 max-w-xs mx-auto shadow-sm"
            style={{ backgroundColor: "#E5DDD5" }}
          >
            <div
              className="rounded-2xl rounded-tl-none max-w-[280px] ml-auto shadow"
              style={{ backgroundColor: "#DCF8C6" }}
            >
              <div className="px-3 py-2">
                {message.trim() ? (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-snug">
                    {"Hola María, te escribimos desde VAIG Depilación Láser.\n\n"}
                    {message}
                    {"\n\nCualquier consulta estamos a tu disposición."}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Tu mensaje aparecerá aquí...</p>
                )}
                <div className="mt-1 flex justify-end">
                  <span className="text-xs text-gray-500">{now} ✓✓</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-md bg-gray-50 border border-gray-200 p-3 space-y-1 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Seleccionados</span>
              <span className="font-medium text-gray-700">{selectedIds.size}</span>
            </div>
            <div className="flex justify-between">
              <span>Template</span>
              <span className="font-medium text-gray-700">campana_general</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatHour(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleTimeString("es-AR", {
    timeZone: LOCAL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function BookingStatusBadge({ booking }: { booking: ReminderBooking }) {
  if (booking.clientConfirmedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Confirmado
      </span>
    );
  }
  if (booking.confirmationSentAt) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
        <Clock className="h-3.5 w-3.5" />
        Enviado
      </span>
    );
  }
  return <span className="text-gray-400">Pendiente</span>;
}

function BookingRow({
  booking,
  selected,
  onToggle,
}: {
  booking: ReminderBooking;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-gray-300 text-brand"
        />
      </td>
      <td className="px-4 py-2.5 font-medium text-gray-800">{booking.clientName}</td>
      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{booking.clientPhone}</td>
      <td className="px-4 py-2.5 text-gray-600">{booking.serviceName}</td>
      <td className="px-4 py-2.5 text-gray-600 tabular-nums">{formatHour(booking.scheduledAt)}</td>
      <td className="px-4 py-2.5 text-xs">
        <BookingStatusBadge booking={booking} />
      </td>
    </tr>
  );
}

function BookingCard({
  booking,
  selected,
  onToggle,
}: {
  booking: ReminderBooking;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="mt-0.5 rounded border-gray-300 text-brand"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-800 truncate">{booking.clientName}</span>
          <span className="tabular-nums text-xs text-gray-500 shrink-0">{formatHour(booking.scheduledAt)}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{booking.serviceName}</div>
        <div className="text-xs text-gray-400 font-mono mt-0.5">{booking.clientPhone}</div>
        <div className="mt-1 text-xs">
          <BookingStatusBadge booking={booking} />
        </div>
      </div>
    </div>
  );
}
