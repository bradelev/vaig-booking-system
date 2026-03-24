"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { toast } from "sonner";
import ConfirmBookingModal, { BookingToConfirm } from "./confirm-booking-modal";
import { updateSession } from "@/actions/sesiones";

interface SessionRow {
  id: string;
  sessionId?: string; // real UUID for editing
  source: "backoffice" | "system";
  clientName: string;
  tipoServicio: string;
  descripcion?: string;
  operadora?: string;
  montoCobrado?: number;
  metodoPago?: string;
  montoLista?: number;
  descuentoPct?: number;
  banco?: string;
  sesionN?: number;
  sesionTotal?: number;
  notas?: string;
  professionalId?: string;
  clientSource?: string;
  time?: string;
  isPendingBooking?: boolean;
  bookingData?: BookingToConfirm;
}

interface DaySessionsTableProps {
  sessions: SessionRow[];
  serviceCategories: string[];
}

const METODOS_PAGO = [
  { value: "", label: "— Sin método —" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "mercado_pago", label: "Mercado Pago" },
];

const METODOS_CON_BANCO = ["transferencia", "debito", "credito"];

interface EditData {
  tipo_servicio: string;
  descripcion: string;
  operadora: string;
  monto_lista: string;
  descuento_pct: string;
  monto_cobrado: string;
  metodo_pago: string;
  banco: string;
  sesion_n: string;
  sesion_total_cuponera: string;
  notas: string;
}

function rowToEditData(row: SessionRow): EditData {
  return {
    tipo_servicio: row.tipoServicio ?? "",
    descripcion: row.descripcion ?? "",
    operadora: row.operadora ?? "",
    monto_lista: row.montoLista != null ? String(row.montoLista) : "",
    descuento_pct: row.descuentoPct != null ? String(row.descuentoPct) : "",
    monto_cobrado: row.montoCobrado != null ? String(row.montoCobrado) : "",
    metodo_pago: row.metodoPago ?? "",
    banco: row.banco ?? "",
    sesion_n: row.sesionN != null ? String(row.sesionN) : "",
    sesion_total_cuponera: row.sesionTotal != null ? String(row.sesionTotal) : "",
    notas: row.notas ?? "",
  };
}

function formatCurrency(n?: number): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

export default function DaySessionsTable({ sessions, serviceCategories }: DaySessionsTableProps) {
  const [confirmBooking, setConfirmBooking] = useState<BookingToConfirm | null>(null);
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

  function startEdit(row: SessionRow) {
    setEditingId(row.id);
    setEditData(rowToEditData(row));
  }

  function updateField(field: keyof EditData, value: string) {
    setEditData((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function saveEdit(row: SessionRow) {
    if (!editData || !row.sessionId) return;
    setSaving(true);
    try {
      const result = await updateSession(row.sessionId, {
        tipo_servicio: editData.tipo_servicio || undefined,
        descripcion: editData.descripcion || null,
        operadora: editData.operadora || null,
        monto_lista: editData.monto_lista !== "" ? Number(editData.monto_lista) : null,
        descuento_pct: editData.descuento_pct !== "" ? Number(editData.descuento_pct) : null,
        monto_cobrado: editData.monto_cobrado !== "" ? Number(editData.monto_cobrado) : null,
        metodo_pago: editData.metodo_pago || null,
        banco: editData.banco || null,
        sesion_n: editData.sesion_n !== "" ? Number(editData.sesion_n) : null,
        sesion_total_cuponera: editData.sesion_total_cuponera !== "" ? Number(editData.sesion_total_cuponera) : null,
        notas: editData.notas || null,
      });
      if (result.success) {
        toast.success("Sesión actualizada");
        cancelEdit();
      } else {
        toast.error(result.error ?? "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
        No hay sesiones para este día
      </div>
    );
  }

  const isEditing = (row: SessionRow) => editingId === row.id && editData != null;
  const canEdit = (row: SessionRow) => !!row.sessionId && !row.isPendingBooking;
  const showBanco = editData ? METODOS_CON_BANCO.includes(editData.metodo_pago) : false;

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
            {sessions.map((row) => {
              const editing = isEditing(row);
              return editing ? (
                <Fragment key={row.id}>
                  {/* Main edit row */}
                  <tr className="bg-blue-50">
                    <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{row.time ?? "—"}</td>
                    <td className="py-2 pr-4 font-medium text-gray-900">{row.clientName}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={editData!.tipo_servicio}
                        onChange={(e) => updateField("tipo_servicio", e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs mb-1"
                      >
                        {serviceCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editData!.descripcion}
                        onChange={(e) => updateField("descripcion", e.target.value)}
                        placeholder="Descripción"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        value={editData!.operadora}
                        onChange={(e) => updateField("operadora", e.target.value)}
                        placeholder="Operadora"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        value={editData!.monto_cobrado}
                        onChange={(e) => updateField("monto_cobrado", e.target.value)}
                        placeholder="Cobrado"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={editData!.metodo_pago}
                        onChange={(e) => updateField("metodo_pago", e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        {METODOS_PAGO.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.source === "system" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {row.source === "system" ? "Sistema" : "Backoffice"}
                      </span>
                    </td>
                    <td className="py-2">
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
                    </td>
                  </tr>
                  {/* Sub-row for extra fields */}
                  <tr className="bg-blue-50 border-t-0">
                    <td colSpan={8} className="pb-3 pt-0 px-0">
                      <div className="flex flex-wrap gap-3 px-2 text-xs items-end">
                        <label className="flex flex-col gap-0.5">
                          <span className="text-gray-500">Monto lista</span>
                          <input
                            type="number"
                            value={editData!.monto_lista}
                            onChange={(e) => updateField("monto_lista", e.target.value)}
                            placeholder="—"
                            className="w-24 rounded border border-gray-300 px-2 py-1"
                            min="0" step="0.01"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-gray-500">Desc. %</span>
                          <input
                            type="number"
                            value={editData!.descuento_pct}
                            onChange={(e) => updateField("descuento_pct", e.target.value)}
                            placeholder="—"
                            className="w-16 rounded border border-gray-300 px-2 py-1"
                            min="0" max="100" step="1"
                          />
                        </label>
                        {showBanco && (
                          <label className="flex flex-col gap-0.5">
                            <span className="text-gray-500">Banco</span>
                            <input
                              type="text"
                              value={editData!.banco}
                              onChange={(e) => updateField("banco", e.target.value)}
                              placeholder="Banco"
                              className="w-28 rounded border border-gray-300 px-2 py-1"
                            />
                          </label>
                        )}
                        <label className="flex flex-col gap-0.5">
                          <span className="text-gray-500">Sesión N°</span>
                          <input
                            type="number"
                            value={editData!.sesion_n}
                            onChange={(e) => updateField("sesion_n", e.target.value)}
                            placeholder="—"
                            className="w-14 rounded border border-gray-300 px-2 py-1"
                            min="1"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-gray-500">De</span>
                          <input
                            type="number"
                            value={editData!.sesion_total_cuponera}
                            onChange={(e) => updateField("sesion_total_cuponera", e.target.value)}
                            placeholder="—"
                            className="w-14 rounded border border-gray-300 px-2 py-1"
                            min="1"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5 flex-1 min-w-40">
                          <span className="text-gray-500">Notas</span>
                          <input
                            type="text"
                            value={editData!.notas}
                            onChange={(e) => updateField("notas", e.target.value)}
                            placeholder="Notas"
                            className="rounded border border-gray-300 px-2 py-1 w-full"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ) : (
                <tr key={row.id} className={row.isPendingBooking ? "bg-amber-50" : ""}>
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
                      row.source === "system" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {row.source === "system" ? "Sistema" : "Backoffice"}
                    </span>
                    {row.clientSource && (
                      <span className="ml-1 text-xs text-gray-400">{row.clientSource}</span>
                    )}
                  </td>
                  <td className="py-2">
                    {row.isPendingBooking && row.bookingData ? (
                      <button
                        onClick={() => setConfirmBooking(row.bookingData!)}
                        className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                      >
                        Confirmar
                      </button>
                    ) : canEdit(row) ? (
                      <button
                        onClick={() => startEdit(row)}
                        title="Editar sesión"
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        ✏️
                      </button>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">✓ Realizada</span>
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
        {sessions.map((row) => {
          const editing = isEditing(row);
          return (
            <div
              key={row.id}
              className={`rounded-lg border p-3 space-y-2 ${
                row.isPendingBooking
                  ? "border-amber-200 bg-amber-50"
                  : editing
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-900">{row.clientName}</div>
                  <div className="text-xs text-gray-500">{row.time ?? ""}{row.time ? " · " : ""}{row.tipoServicio}</div>
                  {row.descripcion && !editing && <div className="text-xs text-gray-400">{row.descripcion}</div>}
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.source === "system" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {row.source === "system" ? "Sistema" : "BO"}
                </span>
              </div>

              {editing ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 gap-2">
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Tipo servicio</span>
                      <select
                        value={editData!.tipo_servicio}
                        onChange={(e) => updateField("tipo_servicio", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {serviceCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Descripción</span>
                      <input
                        type="text"
                        value={editData!.descripcion}
                        onChange={(e) => updateField("descripcion", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Operadora</span>
                      <input
                        type="text"
                        value={editData!.operadora}
                        onChange={(e) => updateField("operadora", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Monto lista</span>
                        <input
                          type="number"
                          value={editData!.monto_lista}
                          onChange={(e) => updateField("monto_lista", e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                          min="0" step="0.01"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Desc. %</span>
                        <input
                          type="number"
                          value={editData!.descuento_pct}
                          onChange={(e) => updateField("descuento_pct", e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                          min="0" max="100"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Cobrado</span>
                      <input
                        type="number"
                        value={editData!.monto_cobrado}
                        onChange={(e) => updateField("monto_cobrado", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        min="0" step="0.01"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Método de pago</span>
                      <select
                        value={editData!.metodo_pago}
                        onChange={(e) => updateField("metodo_pago", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {METODOS_PAGO.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </label>
                    {showBanco && (
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Banco</span>
                        <input
                          type="text"
                          value={editData!.banco}
                          onChange={(e) => updateField("banco", e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Sesión N°</span>
                        <input
                          type="number"
                          value={editData!.sesion_n}
                          onChange={(e) => updateField("sesion_n", e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                          min="1"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">De</span>
                        <input
                          type="number"
                          value={editData!.sesion_total_cuponera}
                          onChange={(e) => updateField("sesion_total_cuponera", e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                          min="1"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Notas</span>
                      <input
                        type="text"
                        value={editData!.notas}
                        onChange={(e) => updateField("notas", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(row)}
                      disabled={saving}
                      className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>{formatCurrency(row.montoCobrado)}</span>
                    {row.metodoPago && <span>{row.metodoPago.replace(/_/g, " ")}</span>}
                    {row.operadora && <span>{row.operadora}</span>}
                  </div>
                  {row.isPendingBooking && row.bookingData ? (
                    <button
                      onClick={() => setConfirmBooking(row.bookingData!)}
                      className="w-full rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                    >
                      Confirmar sesión
                    </button>
                  ) : canEdit(row) ? (
                    <button
                      onClick={() => startEdit(row)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      ✏️ Editar
                    </button>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmBookingModal
        booking={confirmBooking}
        onClose={() => setConfirmBooking(null)}
      />
    </>
  );
}
