"use client";

import { useState, useTransition } from "react";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { relativeDayLabel } from "@/lib/reminders/relative-label";
import { CheckCircle2, Clock, Send, ChevronDown, ChevronRight } from "lucide-react";
import { sendReminders, type SendRemindersResult } from "@/actions/recordatorios";
import { sanitizeTemplateParam } from "@/lib/whatsapp/sanitize";
import type { ReminderBooking, DayGroup } from "./page";

// Meta rejects template parameters with newlines or tabs (error 132018).
// The message uses " · " as paragraph separator. Empty segments are dropped
// server-side by sanitizeTemplateParam.
// {dia_hora} is replaced at send time with the relative day clause derived from
// the booking's scheduled_at, e.g. "hoy a las 10:00" / "mañana a las 08:00".
const DEFAULT_MESSAGE =
  "Recordatorio de reserva · {dia_hora} tenés *{servicio}* · Dirección: {direccion} · {acceso} · {instrucciones_precita} · Mensaje automático, NO responder a este número · Consultas al {telefono}";

interface Props {
  dayGroups: DayGroup[];
  contactPhone: string;
  address: string;
  accessInstructions: string;
}

function getPreCitaPreview(category: string | null): string {
  const cat = (category ?? "").toLowerCase();
  if (cat.includes("depilacion") || cat.includes("laser"))
    return "En caso de que su cita sea para depilación, venir rasurado/a del día anterior.";
  if (cat.includes("facial") || cat.includes("cejas") || cat.includes("pestana"))
    return "En caso de que su cita sea limpieza facial, lifting o perfilado de cejas, venir sin maquillaje.";
  return "";
}

export default function RecordatoriosPageClient({
  dayGroups,
  contactPhone,
  address,
  accessInstructions,
}: Props) {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const unsent = dayGroups.flatMap((g) => g.bookings).filter((b) => !b.confirmationSentAt);
    return new Set(unsent.map((b) => b.id));
  });
  const [resultByDay, setResultByDay] = useState<Record<string, SendRemindersResult>>({});
  const [pendingDay, setPendingDay] = useState<string | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const allBookings = dayGroups.flatMap((g) => g.bookings);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDay(group: DayGroup) {
    const ids = group.bookings.map((b) => b.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleCollapse(dateStr: string) {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }

  function handleSendDay(group: DayGroup) {
    const ids = group.bookings
      .filter((b) => selectedIds.has(b.id))
      .map((b) => b.id);
    if (!ids.length || !message.trim()) return;
    // Build the message for this day's bookings using the day-relative clause for the first booking.
    // The server action will resolve {dia_hora} for each booking individually.
    setPendingDay(group.dateStr);
    startTransition(async () => {
      const res = await sendReminders(ids, message.trim());
      setResultByDay((prev) => ({ ...prev, [group.dateStr]: res }));
      setPendingDay(null);
      if (res.sent > 0) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    });
  }

  const now = new Date().toLocaleTimeString("es-AR", {
    timeZone: LOCAL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

  // Preview: use first selected booking (or first available)
  const previewBookingId = selectedIds.size > 0 ? Array.from(selectedIds)[0] : null;
  const previewBooking = previewBookingId
    ? allBookings.find((b) => b.id === previewBookingId)
    : allBookings[0];

  const previewDayHour = previewBooking
    ? relativeDayLabel(previewBooking.scheduledAt, LOCAL_TIMEZONE, new Date()).clauseEs
    : "mañana a las 10:00";

  const previewMessage = sanitizeTemplateParam(
    message
      .replace(/\{dia_hora\}/g, previewDayHour)
      .replace(/\{hora\}/g, previewBooking ? formatHour(previewBooking.scheduledAt) : "10:00")
      .replace(/\{servicio\}/g, previewBooking?.serviceName ?? "Depilación Láser")
      .replace(/\{direccion\}/g, address || "(configurar VAIG_ADDRESS)")
      .replace(/\{acceso\}/g, accessInstructions || "(configurar VAIG_ACCESS_INSTRUCTIONS)")
      .replace(/\{instrucciones_precita\}/g, previewBooking ? getPreCitaPreview(previewBooking.serviceCategory) : "")
      .replace(/\{telefono\}/g, contactPhone || "(configurar VAIG_CONTACT_PHONE)")
  );

  const totalSelected = selectedIds.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Recordatorios</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Próximos 7 días — {allBookings.length} turno{allBookings.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* LEFT: message editor + day groups */}
        <div className="space-y-5">
          {/* Message editor */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 space-y-2">
            <label className="block text-sm font-medium text-gray-700">Mensaje</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
              placeholder="Escribí el mensaje de recordatorio..."
            />
            <p className="text-xs text-gray-400">
              Se envía usando el template <code>campana_general</code>. El nombre del cliente se agrega automáticamente. Los saltos de línea se convierten en <code> · </code>.
            </p>
            <p className="text-xs text-gray-400">
              Placeholders: <code>{"{dia_hora}"}</code> <code>{"{hora}"}</code> <code>{"{servicio}"}</code> <code>{"{direccion}"}</code> <code>{"{acceso}"}</code> <code>{"{instrucciones_precita}"}</code> <code>{"{telefono}"}</code>
            </p>
          </div>

          {/* Day groups */}
          {dayGroups.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm px-4 py-8 text-center text-sm text-gray-400">
              No hay turnos confirmados en los próximos 7 días.
            </div>
          ) : (
            dayGroups.map((group) => {
              const daySelectedIds = group.bookings
                .filter((b) => selectedIds.has(b.id))
                .map((b) => b.id);
              const allDaySelected =
                group.bookings.length > 0 &&
                group.bookings.every((b) => selectedIds.has(b.id));
              const someDaySelected =
                !allDaySelected && group.bookings.some((b) => selectedIds.has(b.id));
              const isCollapsed = collapsedDays.has(group.dateStr);
              const isPendingThisDay = pendingDay === group.dateStr;
              const dayResult = resultByDay[group.dateStr];

              return (
                <div
                  key={group.dateStr}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  {/* Day header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleCollapse(group.dateStr)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={isCollapsed ? "Expandir" : "Colapsar"}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <input
                        type="checkbox"
                        checked={allDaySelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someDaySelected;
                        }}
                        onChange={() => toggleDay(group)}
                        className="rounded border-gray-300 text-brand"
                      />
                      <span className="text-sm font-semibold text-gray-800">
                        {group.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {group.bookings.length} turno{group.bookings.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <button
                      onClick={() => handleSendDay(group)}
                      disabled={
                        isPendingThisDay ||
                        daySelectedIds.length === 0 ||
                        !message.trim()
                      }
                      className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isPendingThisDay
                        ? "Enviando..."
                        : `Enviar (${daySelectedIds.length})`}
                    </button>
                  </div>

                  {/* Day result banner */}
                  {dayResult && (
                    <div
                      className={`px-4 py-2 text-xs border-b border-gray-100 ${
                        dayResult.failed > 0 && dayResult.sent === 0
                          ? "bg-red-50 text-red-700"
                          : dayResult.failed > 0
                          ? "bg-yellow-50 text-yellow-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {dayResult.sent > 0 &&
                        `✓ ${dayResult.sent} enviado${dayResult.sent !== 1 ? "s" : ""}`}
                      {dayResult.failed > 0 &&
                        `${dayResult.sent > 0 ? "  ·  " : ""}${dayResult.failed} fallido${dayResult.failed !== 1 ? "s" : ""}`}
                    </div>
                  )}

                  {/* Bookings table / cards */}
                  {!isCollapsed && (
                    <>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="w-10 px-4 py-2" />
                              <th className="px-4 py-2 text-left font-medium text-gray-500">Cliente</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-500">Teléfono</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-500">Servicio</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-500">Hora</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-500">Profesional</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-500">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {group.bookings.map((booking) => (
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

                      <div className="md:hidden divide-y divide-gray-100">
                        {group.bookings.map((booking) => (
                          <BookingCard
                            key={booking.id}
                            booking={booking}
                            selected={selectedIds.has(booking.id)}
                            onToggle={() => toggleSelect(booking.id)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}

          {/* Global selection summary */}
          {dayGroups.length > 0 && (
            <p className="text-xs text-gray-400 text-right">
              {totalSelected} turno{totalSelected !== 1 ? "s" : ""} seleccionado{totalSelected !== 1 ? "s" : ""} en total
            </p>
          )}
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
                    {"Hola {nombre}, te escribimos desde VAIG Depilación Láser.\n\n"}
                    {previewMessage}
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
              <span>Seleccionados total</span>
              <span className="font-medium text-gray-700">{totalSelected}</span>
            </div>
            <div className="flex justify-between">
              <span>Template</span>
              <span className="font-medium text-gray-700">campana_general</span>
            </div>
            <div className="flex justify-between">
              <span>Auto-send</span>
              <span className="font-medium text-gray-700">9 AM UYT (cron)</span>
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
      <td className="px-4 py-2.5 text-gray-500 text-xs">{booking.professionalName ?? "—"}</td>
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
        {booking.professionalName && (
          <div className="text-xs text-gray-400 mt-0.5">{booking.professionalName}</div>
        )}
        <div className="text-xs text-gray-400 font-mono mt-0.5">{booking.clientPhone}</div>
        <div className="mt-1 text-xs">
          <BookingStatusBadge booking={booking} />
        </div>
      </div>
    </div>
  );
}
