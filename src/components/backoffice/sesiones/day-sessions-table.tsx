"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { toast } from "sonner";
import { updateSession, confirmBookingAsSession, searchClients, deleteSession } from "@/actions/sesiones";
import type { Professional } from "@/components/backoffice/sesiones/session-form";

export interface PendingBookingData {
  id: string;
  clientName: string;
  clientId?: string;
  serviceName: string;
  serviceCategory: string;
  scheduledAt: string;
  professionalName?: string;
  professionalId?: string;
}

interface ServiceOption {
  id: string;
  name: string;
  category: string | null;
  price: number;
}

interface SessionRow {
  id: string;
  sessionId?: string;
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
  bookingData?: PendingBookingData;
}

interface EditData {
  // Client
  client_id: string;
  client_name: string;
  // Date/time
  fecha: string;
  hora: string;
  // Service
  tipo_servicio: string;
  descripcion: string;
  // Professional
  operadora: string;
  professional_id: string;
  // Payment
  monto_lista: string;
  descuento_pct: string;
  monto_cobrado: string;
  metodo_pago: string;
  banco: string;
  // Package
  sesion_n: string;
  sesion_total_cuponera: string;
  // Notes
  notas: string;
}

interface DaySessionsTableProps {
  sessions: SessionRow[];
  serviceCategories: string[];
  services: ServiceOption[];
  professionals: Professional[];
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

function formatCurrency(n?: number): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

/** Parse HH:MM from an ISO string in ART timezone */
function parseTimeART(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
  });
}

/** Parse YYYY-MM-DD from an ISO string in ART timezone */
function parseDateART(isoString: string): string {
  return new Date(isoString).toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function rowToEditData(row: SessionRow): EditData {
  const fecha = row.bookingData?.scheduledAt
    ? parseDateART(row.bookingData.scheduledAt)
    : "";
  const hora = row.bookingData?.scheduledAt
    ? parseTimeART(row.bookingData.scheduledAt)
    : "";

  return {
    client_id: row.bookingData?.clientId ?? "",
    client_name: row.clientName,
    fecha,
    hora,
    tipo_servicio: row.tipoServicio ?? "",
    descripcion: row.descripcion ?? "",
    operadora: row.operadora ?? "",
    professional_id: row.professionalId ?? "",
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

// ─── Client search combobox (inline) ────────────────────────────────────────

interface ClientResult {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

interface ClientComboboxProps {
  value: string;       // display name
  clientId: string;
  onChange: (id: string, name: string) => void;
  className?: string;
}

function ClientCombobox({ value, onChange, className }: ClientComboboxProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ClientResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  function handleInput(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await searchClients(q);
      setResults(res);
      setOpen(res.length > 0);
    }, 300);
  }

  function select(c: ClientResult) {
    const name = `${c.first_name} ${c.last_name}`;
    setQuery(name);
    setOpen(false);
    onChange(c.id, name);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        className={className}
        placeholder="Buscar cliente..."
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg text-xs">
          {results.map((c) => (
            <li
              key={c.id}
              onMouseDown={() => select(c)}
              className="cursor-pointer px-3 py-2 hover:bg-gray-50"
            >
              <span className="font-medium">{c.first_name} {c.last_name}</span>
              {c.phone && <span className="ml-2 text-gray-400">{c.phone}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function DaySessionsTable({
  sessions,
  serviceCategories,
  services,
  professionals,
}: DaySessionsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(row: SessionRow) {
    if (!row.sessionId) return;
    if (!window.confirm("¿Eliminar esta sesión? Esta acción no se puede deshacer.")) return;
    setDeletingId(row.id);
    try {
      const result = await deleteSession(row.sessionId);
      if (result.success) {
        toast.success("Sesión eliminada");
      } else {
        toast.error(result.error ?? "Error al eliminar");
      }
    } finally {
      setDeletingId(null);
    }
  }

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
    if (!editData) return;
    setSaving(true);
    try {
      if (row.isPendingBooking && row.bookingData) {
        const result = await confirmBookingAsSession(row.bookingData.id, {
          client_id: editData.client_id || undefined,
          fecha: editData.fecha || undefined,
          hora: editData.hora || undefined,
          tipo_servicio: editData.tipo_servicio || undefined,
          descripcion: editData.descripcion || undefined,
          operadora: editData.operadora || undefined,
          professional_id: editData.professional_id || undefined,
          monto_lista: editData.monto_lista !== "" ? Number(editData.monto_lista) : undefined,
          descuento_pct: editData.descuento_pct !== "" ? Number(editData.descuento_pct) : undefined,
          monto_cobrado: editData.monto_cobrado !== "" ? Number(editData.monto_cobrado) : undefined,
          metodo_pago: editData.metodo_pago || undefined,
          banco: editData.banco || undefined,
          sesion_n: editData.sesion_n !== "" ? Number(editData.sesion_n) : undefined,
          sesion_total_cuponera: editData.sesion_total_cuponera !== "" ? Number(editData.sesion_total_cuponera) : undefined,
          notas: editData.notas || undefined,
        });
        if (result.success) {
          toast.success("Sesión confirmada");
          cancelEdit();
        } else {
          toast.error(result.error ?? "Error al confirmar");
        }
      } else if (row.sessionId) {
        const result = await updateSession(row.sessionId, {
          client_id: editData.client_id || null,
          fecha: editData.fecha || null,
          tipo_servicio: editData.tipo_servicio || undefined,
          descripcion: editData.descripcion || null,
          operadora: editData.operadora || null,
          professional_id: editData.professional_id || null,
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
  const canEdit = (row: SessionRow) => !!row.isPendingBooking || !!row.sessionId;
  const showBanco = editData ? METODOS_CON_BANCO.includes(editData.metodo_pago) : false;

  // Inline edit form — shared between desktop sub-row and mobile card
  function renderEditFields(row: SessionRow) {
    if (!editData) return null;
    return (
      <>
        {/* Fecha (only for pending bookings — hora is in the main row Hora cell) */}
        {row.isPendingBooking && (
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-gray-500">Fecha</span>
            <input
              type="date"
              value={editData.fecha}
              onChange={(e) => updateField("fecha", e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 w-32"
            />
          </label>
        )}
        {/* Monto lista */}
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Monto lista</span>
          <input
            type="number"
            value={editData.monto_lista}
            onChange={(e) => updateField("monto_lista", e.target.value)}
            placeholder="—"
            className="w-24 rounded border border-gray-300 px-2 py-1"
            min="0" step="0.01"
          />
        </label>
        {/* Desc % */}
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Desc. %</span>
          <input
            type="number"
            value={editData.descuento_pct}
            onChange={(e) => updateField("descuento_pct", e.target.value)}
            placeholder="—"
            className="w-16 rounded border border-gray-300 px-2 py-1"
            min="0" max="100" step="1"
          />
        </label>
        {/* Banco (conditional) */}
        {showBanco && (
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-gray-500">Banco</span>
            <input
              type="text"
              value={editData.banco}
              onChange={(e) => updateField("banco", e.target.value)}
              placeholder="Banco"
              className="w-28 rounded border border-gray-300 px-2 py-1"
            />
          </label>
        )}
        {/* Sesión N° / De */}
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Sesión N°</span>
          <input
            type="number"
            value={editData.sesion_n}
            onChange={(e) => updateField("sesion_n", e.target.value)}
            placeholder="—"
            className="w-14 rounded border border-gray-300 px-2 py-1"
            min="1"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">De</span>
          <input
            type="number"
            value={editData.sesion_total_cuponera}
            onChange={(e) => updateField("sesion_total_cuponera", e.target.value)}
            placeholder="—"
            className="w-14 rounded border border-gray-300 px-2 py-1"
            min="1"
          />
        </label>
        {/* Notas */}
        <label className="flex flex-col gap-0.5 text-xs flex-1 min-w-40">
          <span className="text-gray-500">Notas</span>
          <input
            type="text"
            value={editData.notas}
            onChange={(e) => updateField("notas", e.target.value)}
            placeholder="Notas"
            className="rounded border border-gray-300 px-2 py-1 w-full"
          />
        </label>
      </>
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
            {sessions.map((row) => {
              const editing = isEditing(row);
              return editing ? (
                <Fragment key={row.id}>
                  {/* Main edit row */}
                  <tr className="bg-blue-50">
                    {/* Hora */}
                    <td className="py-2 pr-4 text-gray-500 whitespace-nowrap align-top pt-3">
                      {row.isPendingBooking && editData ? (
                        <input
                          type="time"
                          value={editData.hora}
                          onChange={(e) => updateField("hora", e.target.value)}
                          className="w-20 rounded border border-gray-300 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        row.time ?? "—"
                      )}
                    </td>
                    {/* Cliente */}
                    <td className="py-2 pr-4 align-top pt-3">
                      <ClientCombobox
                        value={editData!.client_name}
                        clientId={editData!.client_id}
                        onChange={(id, name) => setEditData((prev) => prev ? { ...prev, client_id: id, client_name: name } : prev)}
                        className="w-36 rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </td>
                    {/* Servicio */}
                    <td className="py-2 pr-3 align-top pt-3">
                      <select
                        value={editData!.tipo_servicio}
                        onChange={(e) => {
                          updateField("tipo_servicio", e.target.value);
                        }}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs mb-1"
                      >
                        {serviceCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        value={editData!.descripcion}
                        onChange={(e) => {
                          const svc = services.find((s) => s.name === e.target.value);
                          updateField("descripcion", e.target.value);
                          if (svc && editData!.monto_lista === "") {
                            updateField("monto_lista", String(svc.price));
                          }
                        }}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        <option value="">— Servicio específico —</option>
                        {services
                          .filter((s) => !editData!.tipo_servicio || s.category === editData!.tipo_servicio)
                          .map((s) => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                      </select>
                    </td>
                    {/* Operadora */}
                    <td className="py-2 pr-3 align-top pt-3">
                      <select
                        value={editData!.professional_id}
                        onChange={(e) => {
                          const prof = professionals.find((p) => p.id === e.target.value);
                          setEditData((prev) => prev ? {
                            ...prev,
                            professional_id: e.target.value,
                            operadora: prof?.name ?? prev.operadora,
                          } : prev);
                        }}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs mb-1"
                      >
                        <option value="">— Profesional —</option>
                        {professionals.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editData!.operadora}
                        onChange={(e) => updateField("operadora", e.target.value)}
                        placeholder="Operadora"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </td>
                    {/* Cobrado */}
                    <td className="py-2 pr-3 align-top pt-3">
                      <input
                        type="number"
                        value={editData!.monto_cobrado}
                        onChange={(e) => updateField("monto_cobrado", e.target.value)}
                        placeholder="Cobrado"
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                        min="0" step="0.01"
                      />
                    </td>
                    {/* Método */}
                    <td className="py-2 pr-3 align-top pt-3">
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
                    {/* Origen */}
                    <td className="py-2 pr-4 align-top pt-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.source === "system" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {row.source === "system" ? "Sistema" : "Backoffice"}
                      </span>
                    </td>
                    {/* Acciones */}
                    <td className="py-2 align-top pt-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => saveEdit(row)}
                          disabled={saving}
                          title={row.isPendingBooking ? "Confirmar sesión" : "Guardar"}
                          className="rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {row.isPendingBooking ? "Confirmar" : "✓"}
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
                        {renderEditFields(row)}
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
                    {canEdit(row) ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(row)}
                          title={row.isPendingBooking ? "Editar y confirmar" : "Editar sesión"}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
                            row.isPendingBooking
                              ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "border-gray-300 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {row.isPendingBooking ? "Editar / Confirmar" : "✏️"}
                        </button>
                        {row.sessionId && (
                          <button
                            onClick={() => handleDelete(row)}
                            disabled={deletingId === row.id}
                            title="Eliminar sesión"
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {deletingId === row.id ? "…" : "🗑️"}
                          </button>
                        )}
                      </div>
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
                row.isPendingBooking && !editing
                  ? "border-amber-200 bg-amber-50"
                  : editing
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-900">{editing ? editData!.client_name : row.clientName}</div>
                  <div className="text-xs text-gray-500">
                    {row.time ?? ""}{row.time ? " · " : ""}{row.tipoServicio}
                  </div>
                  {row.descripcion && !editing && (
                    <div className="text-xs text-gray-400">{row.descripcion}</div>
                  )}
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.source === "system" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {row.source === "system" ? "Sistema" : "BO"}
                </span>
              </div>

              {editing ? (
                <div className="space-y-2 pt-1">
                  {/* Cliente */}
                  <label className="flex flex-col gap-0.5 text-xs">
                    <span className="text-gray-500">Cliente</span>
                    <ClientCombobox
                      value={editData!.client_name}
                      clientId={editData!.client_id}
                      onChange={(id, name) => setEditData((prev) => prev ? { ...prev, client_id: id, client_name: name } : prev)}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm w-full"
                    />
                  </label>
                  {/* Fecha + hora (pending only) */}
                  {row.isPendingBooking && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Fecha</span>
                        <input
                          type="date"
                          value={editData!.fecha}
                          onChange={(e) => updateField("fecha", e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Hora</span>
                        <input
                          type="time"
                          value={editData!.hora}
                          onChange={(e) => updateField("hora", e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>
                  )}
                  {/* Servicio */}
                  <label className="flex flex-col gap-0.5 text-xs">
                    <span className="text-gray-500">Categoría</span>
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
                    <span className="text-gray-500">Servicio</span>
                    <select
                      value={editData!.descripcion}
                      onChange={(e) => {
                        const svc = services.find((s) => s.name === e.target.value);
                        updateField("descripcion", e.target.value);
                        if (svc && editData!.monto_lista === "") {
                          updateField("monto_lista", String(svc.price));
                        }
                      }}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— Seleccionar —</option>
                      {services
                        .filter((s) => !editData!.tipo_servicio || s.category === editData!.tipo_servicio)
                        .map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                    </select>
                  </label>
                  {/* Profesional */}
                  <label className="flex flex-col gap-0.5 text-xs">
                    <span className="text-gray-500">Profesional</span>
                    <select
                      value={editData!.professional_id}
                      onChange={(e) => {
                        const prof = professionals.find((p) => p.id === e.target.value);
                        setEditData((prev) => prev ? {
                          ...prev,
                          professional_id: e.target.value,
                          operadora: prof?.name ?? prev.operadora,
                        } : prev);
                      }}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— Profesional —</option>
                      {professionals.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
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
                  {/* Montos */}
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
                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(row)}
                      disabled={saving}
                      className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {row.isPendingBooking ? "Confirmar sesión" : "Guardar"}
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
                  {canEdit(row) ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(row)}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          row.isPendingBooking
                            ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {row.isPendingBooking ? "✏️ Editar / Confirmar" : "✏️ Editar"}
                      </button>
                      {row.sessionId && (
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row.id}
                          title="Eliminar sesión"
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingId === row.id ? "…" : "🗑️"}
                        </button>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
