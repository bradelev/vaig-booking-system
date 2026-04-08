"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Combobox, { type ComboboxItem } from "@/components/backoffice/agenda/combobox";
import StatusBadge from "@/components/backoffice/status-badge";
import { updateBookingInline } from "@/actions/citas";
import type { BookingItem } from "@/app/backoffice/citas/page";
import CancelModal from "@/components/backoffice/cancel-modal";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "deposit_paid", label: "Seña pagada" },
  { value: "confirmed", label: "Confirmada" },
  { value: "realized", label: "Realizada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No show" },
];

interface EditData {
  clientId: string;
  serviceId: string;
  professionalId: string;
  scheduledAt: string; // datetime-local: YYYY-MM-DDTHH:mm
  status: string;
  notes: string;
}

function rowToEditData(row: BookingItem): EditData {
  const localDt = new Date(row.scheduledAt)
    .toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" })
    .replace(" ", "T")
    .slice(0, 16);
  return {
    clientId: row.clientId,
    serviceId: row.serviceId,
    professionalId: row.professionalId ?? "",
    scheduledAt: localDt,
    status: row.status,
    notes: row.notes ?? "",
  };
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

interface DayBookingsTableProps {
  bookings: BookingItem[];
  allClients: ComboboxItem[];
  allServices: ComboboxItem[];
  allProfessionals: ComboboxItem[];
}

export default function DayBookingsTable({
  bookings,
  allClients,
  allServices,
  allProfessionals,
}: DayBookingsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData | null>(null);
  const [saving, setSaving] = useState(false);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditData(null);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && editingId) cancelEdit();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingId, cancelEdit]);

  function startEdit(row: BookingItem) {
    setEditingId(row.id);
    setEditData(rowToEditData(row));
  }

  function updateField(field: keyof EditData, value: string) {
    setEditData((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function saveEdit(row: BookingItem) {
    if (!editData) return;
    setSaving(true);
    try {
      const scheduledAtISO = new Date(editData.scheduledAt + ":00-03:00").toISOString();
      const result = await updateBookingInline(row.id, {
        client_id: editData.clientId || undefined,
        service_id: editData.serviceId || undefined,
        professional_id: editData.professionalId || null,
        scheduled_at: scheduledAtISO,
        status: editData.status,
        notes: editData.notes || null,
      });
      if (result.success) {
        toast.success("Cita actualizada");
        cancelEdit();
      } else {
        toast.error(result.error ?? "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  const isEditing = (row: BookingItem) => editingId === row.id && editData != null;

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="pb-2 pr-3 w-16">Hora</th>
              <th className="pb-2 pr-3">Cliente</th>
              <th className="pb-2 pr-3">Servicio</th>
              <th className="pb-2 pr-3">Profesional</th>
              <th className="pb-2 pr-3 w-32">Estado</th>
              <th className="pb-2 pr-3">Notas</th>
              <th className="pb-2 w-20">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.map((row) => {
              const editing = isEditing(row);
              return (
                <tr
                  key={row.id}
                  className={editing ? "bg-blue-50" : "hover:bg-gray-50"}
                >
                  {/* Hora */}
                  <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap align-top">
                    {editing ? (
                      <input
                        type="datetime-local"
                        value={editData!.scheduledAt}
                        onChange={(e) => updateField("scheduledAt", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs w-36"
                      />
                    ) : (
                      formatTime(row.scheduledAt)
                    )}
                  </td>

                  {/* Cliente */}
                  <td className="py-2.5 pr-3 font-medium text-gray-900 align-top">
                    {editing ? (
                      <div className="relative overflow-visible min-w-[180px]">
                        <Combobox
                          items={allClients}
                          value={editData!.clientId}
                          onChange={(id) => updateField("clientId", id)}
                          placeholder="Buscar cliente..."
                        />
                      </div>
                    ) : (
                      <div>
                        <p>{row.clientName}</p>
                        {row.clientPhone && (
                          <p className="text-xs text-gray-400">{row.clientPhone}</p>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Servicio */}
                  <td className="py-2.5 pr-3 text-gray-700 align-top">
                    {editing ? (
                      <div className="relative overflow-visible min-w-[200px]">
                        <Combobox
                          items={allServices}
                          value={editData!.serviceId}
                          onChange={(id) => updateField("serviceId", id)}
                          placeholder="Buscar servicio..."
                        />
                      </div>
                    ) : (
                      row.serviceName
                    )}
                  </td>

                  {/* Profesional */}
                  <td className="py-2.5 pr-3 text-gray-700 align-top">
                    {editing ? (
                      <div className="relative overflow-visible min-w-[150px]">
                        <Combobox
                          items={allProfessionals}
                          value={editData!.professionalId}
                          onChange={(id) => updateField("professionalId", id)}
                          placeholder="Profesional..."
                        />
                      </div>
                    ) : (
                      row.professionalName ?? "—"
                    )}
                  </td>

                  {/* Estado */}
                  <td className="py-2.5 pr-3 align-top">
                    {editing ? (
                      <select
                        value={editData!.status}
                        onChange={(e) => updateField("status", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs w-full"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={row.status} />
                    )}
                  </td>

                  {/* Notas */}
                  <td className="py-2.5 pr-3 text-gray-500 text-xs align-top">
                    {editing ? (
                      <input
                        type="text"
                        value={editData!.notes}
                        onChange={(e) => updateField("notes", e.target.value)}
                        placeholder="Notas..."
                        className="rounded border border-gray-300 px-2 py-1 text-xs w-full"
                      />
                    ) : (
                      row.notes ?? "—"
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="py-2.5 align-top">
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => saveEdit(row)}
                          disabled={saving}
                          title="Guardar"
                          className="rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEdit}
                          title="Cancelar"
                          className="rounded-lg bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(row)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Editar
                        </button>
                        {row.status !== "cancelled" && row.status !== "realized" && row.status !== "no_show" && (
                          <CancelModal bookingId={row.id} />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {bookings.map((row) => {
          const editing = isEditing(row);
          return (
            <div
              key={row.id}
              className={`rounded-lg border p-3 ${editing ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}
            >
              {editing ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Fecha y hora</label>
                    <input
                      type="datetime-local"
                      value={editData!.scheduledAt}
                      onChange={(e) => updateField("scheduledAt", e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
                    <Combobox
                      items={allClients}
                      value={editData!.clientId}
                      onChange={(id) => updateField("clientId", id)}
                      placeholder="Buscar cliente..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Servicio</label>
                    <Combobox
                      items={allServices}
                      value={editData!.serviceId}
                      onChange={(id) => updateField("serviceId", id)}
                      placeholder="Buscar servicio..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Profesional</label>
                    <Combobox
                      items={allProfessionals}
                      value={editData!.professionalId}
                      onChange={(id) => updateField("professionalId", id)}
                      placeholder="Profesional..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                    <select
                      value={editData!.status}
                      onChange={(e) => updateField("status", e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm w-full"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
                    <input
                      type="text"
                      value={editData!.notes}
                      onChange={(e) => updateField("notes", e.target.value)}
                      placeholder="Notas..."
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm w-full"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={cancelEdit}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => saveEdit(row)}
                      disabled={saving}
                      className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(row.scheduledAt)}
                      </span>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="font-medium text-gray-900 text-sm truncate">{row.clientName}</p>
                    <p className="text-xs text-gray-500 truncate">{row.serviceName}</p>
                    {row.professionalName && (
                      <p className="text-xs text-gray-400">{row.professionalName}</p>
                    )}
                    {row.notes && (
                      <p className="text-xs text-gray-400 italic truncate">{row.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button
                      onClick={() => startEdit(row)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    {row.status !== "cancelled" && row.status !== "realized" && row.status !== "no_show" && (
                      <CancelModal bookingId={row.id} />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
