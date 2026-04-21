"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { toast } from "sonner";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { StickyNote } from "lucide-react";
import {
  updateSession,
  confirmBookingAsSession,
  searchClients,
  deleteSession,
  createSession,
  quickCreateClientForSession,
} from "@/actions/sesiones";
import Modal from "@/components/backoffice/modal";
import { METODOS_PAGO, METODOS_CON_BANCO } from "@/lib/constants/payment-methods";

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

export interface Professional {
  id: string;
  name: string;
}

interface ServiceOption {
  id: string;
  name: string;
  category: string | null;
  price: number;
}

export interface SessionRow {
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
  client_id: string;
  client_name: string;
  fecha: string;
  hora: string;
  tipo_servicio: string;
  descripcion: string;
  operadora: string;
  professional_id: string;
  monto_lista: string;
  descuento_pct: string;
  monto_cobrado: string;
  metodo_pago: string;
  banco: string;
  sesion_n: string;
  sesion_total_cuponera: string;
  notas: string;
}

interface NewRowData {
  clientId: string;
  clientLabel: string;
  tipoServicio: string;
  descripcion: string;
  operadora: string;
  professionalId: string;
  montoCobrado: string;
  metodoPago: string;
  montoLista: string;
  descuentoPct: string;
  banco: string;
  sesionN: string;
  sesionTotal: string;
  notas: string;
}

interface SessionsDayTableProps {
  sessions: SessionRow[];
  serviceCategories: string[];
  services: ServiceOption[];
  professionals: Professional[];
  activeDate: string; // YYYY-MM-DD
}


const SOURCES = ["Instagram", "Referido", "Enfoque", "WeFitness", "Google", "Ruleta", "Otro"] as const;

function formatCurrency(n?: number): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

function parseDateART(isoString: string): string {
  return new Date(isoString).toLocaleDateString("sv-SE", { timeZone: LOCAL_TIMEZONE });
}

function parseTimeART(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: LOCAL_TIMEZONE,
    hour12: false,
  });
}

function rowToEditData(row: SessionRow): EditData {
  const fecha = row.bookingData?.scheduledAt ? parseDateART(row.bookingData.scheduledAt) : "";
  const hora = row.bookingData?.scheduledAt ? parseTimeART(row.bookingData.scheduledAt) : "";
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

function emptyNewRow(): NewRowData {
  return {
    clientId: "",
    clientLabel: "",
    tipoServicio: "",
    descripcion: "",
    operadora: "",
    professionalId: "",
    montoCobrado: "",
    metodoPago: "",
    montoLista: "",
    descuentoPct: "",
    banco: "",
    sesionN: "",
    sesionTotal: "",
    notas: "",
  };
}

// ─── Inline client search combobox ──────────────────────────────────────────

interface ClientResult {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

interface ClientComboboxProps {
  value: string;
  clientId: string;
  onChange: (id: string, name: string) => void;
  className?: string;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onCreateNew?: (query: string) => void;
}

function ClientCombobox({ value, onChange, className, placeholder, inputRef, onCreateNew }: ClientComboboxProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ClientResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  function handleInput(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await searchClients(q);
      setResults(res);
      setOpen(res.length > 0 || (!!onCreateNew && q.length >= 2));
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
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        className={className}
        placeholder={placeholder ?? "Buscar cliente..."}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 mt-1 max-h-48 w-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg text-xs">
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
          {onCreateNew && query.length >= 2 && (
            <li
              onMouseDown={() => { setOpen(false); onCreateNew(query); }}
              className="cursor-pointer px-3 py-2 text-primary hover:bg-primary/5 border-t border-gray-100 font-medium"
            >
              + Crear: {query}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function SessionsDayTable({
  sessions,
  serviceCategories,
  services,
  professionals,
  activeDate,
}: SessionsDayTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline creation row state
  const [newRow, setNewRow] = useState<NewRowData>(emptyNewRow);
  const [newRowExpanded, setNewRowExpanded] = useState(false);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newClientKey, setNewClientKey] = useState(0);
  const newClientRef = useRef<HTMLInputElement | null>(null);

  // Mobile: show inline creation card
  const [showMobileCreate, setShowMobileCreate] = useState(false);

  // Quick create client modal
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [createClientQuery, setCreateClientQuery] = useState("");
  const [ncFirstName, setNcFirstName] = useState("");
  const [ncLastName, setNcLastName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncInstagram, setNcInstagram] = useState("");
  const [ncSource, setNcSource] = useState("");
  const [ncReferidoPor, setNcReferidoPor] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

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

  function updateNewRow(field: keyof NewRowData, value: string) {
    setNewRow((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-compute cobrado from lista + desc
      if (field === "montoLista" || field === "descuentoPct") {
        const lista = parseFloat(field === "montoLista" ? value : next.montoLista);
        const pct = parseFloat(field === "descuentoPct" ? value : next.descuentoPct);
        if (!isNaN(lista) && !isNaN(pct)) {
          next.montoCobrado = (lista * (1 - pct / 100)).toFixed(2);
        }
      }
      // Auto-expand secondary fields for banco when payment method requires it
      if (field === "metodoPago" && METODOS_CON_BANCO.includes(value)) {
        setNewRowExpanded(true);
      }
      return next;
    });
  }

  async function handleSubmitNew(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newRow.clientId) { toast.error("Seleccioná un cliente"); return; }
    if (!newRow.tipoServicio) { toast.error("Seleccioná el tipo de servicio"); return; }
    setSubmittingNew(true);
    const result = await createSession({
      client_id: newRow.clientId,
      fecha: activeDate,
      tipo_servicio: newRow.tipoServicio,
      descripcion: newRow.descripcion || undefined,
      operadora: newRow.operadora || undefined,
      professional_id: newRow.professionalId || undefined,
      monto_lista: newRow.montoLista !== "" ? parseFloat(newRow.montoLista) : undefined,
      descuento_pct: newRow.descuentoPct !== "" ? parseFloat(newRow.descuentoPct) : undefined,
      monto_cobrado: newRow.montoCobrado !== "" ? parseFloat(newRow.montoCobrado) : undefined,
      metodo_pago: newRow.metodoPago || undefined,
      banco: newRow.banco || undefined,
      sesion_n: newRow.sesionN ? parseInt(newRow.sesionN) : undefined,
      sesion_total_cuponera: newRow.sesionTotal ? parseInt(newRow.sesionTotal) : undefined,
      notas: newRow.notas || undefined,
    });
    setSubmittingNew(false);
    if (result.success) {
      toast.success("Sesión registrada");
      setNewRow(emptyNewRow());
      setNewRowExpanded(false);
      setNewClientKey((k) => k + 1);
      setShowMobileCreate(false);
      setTimeout(() => newClientRef.current?.focus(), 50);
    } else {
      toast.error(result.error ?? "Error al registrar");
    }
  }

  async function handleDelete(row: SessionRow) {
    if (!row.sessionId) return;
    if (!window.confirm("¿Eliminar esta sesión? Esta acción no se puede deshacer.")) return;
    setDeletingId(row.id);
    try {
      const result = await deleteSession(row.sessionId);
      if (result.success) toast.success("Sesión eliminada");
      else toast.error(result.error ?? "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
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
        if (result.success) { toast.success("Sesión confirmada"); cancelEdit(); }
        else toast.error(result.error ?? "Error al confirmar");
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
        if (result.success) { toast.success("Sesión actualizada"); cancelEdit(); }
        else toast.error(result.error ?? "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!ncFirstName || !ncLastName || !ncPhone) return;
    setCreatingClient(true);
    const result = await quickCreateClientForSession({
      first_name: ncFirstName,
      last_name: ncLastName,
      phone: ncPhone,
      instagram: ncInstagram || undefined,
      source: ncSource || undefined,
      referido_por: ncReferidoPor || undefined,
    });
    setCreatingClient(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      const label = `${result.first_name} ${result.last_name}`;
      setNewRow((prev) => ({ ...prev, clientId: result.id, clientLabel: label }));
      setNewClientKey((k) => k + 1);
      setShowCreateClient(false);
      setNcFirstName(""); setNcLastName(""); setNcPhone("");
      setNcInstagram(""); setNcSource(""); setNcReferidoPor("");
      toast.success("Cliente creado");
    }
  }

  function openCreateClient(query: string) {
    setCreateClientQuery(query);
    const parts = query.split(" ");
    setNcFirstName(parts[0] ?? "");
    setNcLastName(parts.slice(1).join(" ") ?? "");
    setShowCreateClient(true);
  }

  // ─── Daily summary ────────────────────────────────────────────────────────

  const confirmedSessions = sessions.filter((s) => !s.isPendingBooking && s.montoCobrado != null);
  const pendingCount = sessions.filter((s) => s.isPendingBooking).length;
  const totalCobrado = confirmedSessions.reduce((sum, s) => sum + (s.montoCobrado ?? 0), 0);
  const byMethod = sessions.reduce<Record<string, number>>((acc, s) => {
    if (!s.metodoPago || s.isPendingBooking) return acc;
    const key = s.metodoPago.replace(/_/g, " ");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const isEditing = (row: SessionRow) => editingId === row.id && editData != null;
  const canEdit = (row: SessionRow) => !!row.isPendingBooking || !!row.sessionId;
  const showEditBanco = editData ? METODOS_CON_BANCO.includes(editData.metodo_pago) : false;
  const showNewBanco = METODOS_CON_BANCO.includes(newRow.metodoPago);

  const inputCls = "rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40";
  const selectCls = "rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40";

  // Inline edit sub-row (extra fields)
  function renderEditFields(row: SessionRow) {
    if (!editData) return null;
    return (
      <>
        {row.isPendingBooking && (
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-gray-500">Fecha</span>
            <input type="date" value={editData.fecha} onChange={(e) => updateField("fecha", e.target.value)} className={`${inputCls} w-32`} />
          </label>
        )}
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Monto lista</span>
          <input type="number" value={editData.monto_lista} onChange={(e) => updateField("monto_lista", e.target.value)} placeholder="—" className={`${inputCls} w-24`} min="0" step="0.01" />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Desc. %</span>
          <input type="number" value={editData.descuento_pct} onChange={(e) => updateField("descuento_pct", e.target.value)} placeholder="—" className={`${inputCls} w-16`} min="0" max="100" step="1" />
        </label>
        {showEditBanco && (
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-gray-500">Banco</span>
            <input type="text" value={editData.banco} onChange={(e) => updateField("banco", e.target.value)} placeholder="Banco" className={`${inputCls} w-28`} />
          </label>
        )}
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Sesión N°</span>
          <input type="number" value={editData.sesion_n} onChange={(e) => updateField("sesion_n", e.target.value)} placeholder="—" className={`${inputCls} w-14`} min="1" />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">De</span>
          <input type="number" value={editData.sesion_total_cuponera} onChange={(e) => updateField("sesion_total_cuponera", e.target.value)} placeholder="—" className={`${inputCls} w-14`} min="1" />
        </label>
        <label className="flex flex-col gap-0.5 text-xs flex-1 min-w-40">
          <span className="text-gray-500">Notas</span>
          <input type="text" value={editData.notas} onChange={(e) => updateField("notas", e.target.value)} placeholder="Notas" className={`${inputCls} w-full`} />
        </label>
      </>
    );
  }

  // Shared mobile create/edit form fields (reused in both contexts)
  function renderMobileNewForm() {
    return (
      <div className="space-y-2 pt-1">
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Cliente *</span>
          <ClientCombobox
            key={newClientKey}
            value={newRow.clientLabel}
            clientId={newRow.clientId}
            onChange={(id, label) => setNewRow((p) => ({ ...p, clientId: id, clientLabel: label }))}
            className={`${inputCls} w-full text-sm`}
            inputRef={newClientRef}
            onCreateNew={openCreateClient}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Tipo de servicio *</span>
          <select
            value={newRow.tipoServicio}
            onChange={(e) => updateNewRow("tipoServicio", e.target.value)}
            className={`${selectCls} w-full text-sm`}
          >
            <option value="">Seleccionar...</option>
            {serviceCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Servicio específico</span>
          <select
            value={newRow.descripcion}
            onChange={(e) => {
              const svc = services.find((s) => s.name === e.target.value);
              setNewRow((p) => {
                const next = { ...p, descripcion: e.target.value };
                if (svc && !p.montoLista) {
                  next.montoLista = String(svc.price);
                  const pct = parseFloat(p.descuentoPct);
                  next.montoCobrado = isNaN(pct) ? String(svc.price) : (svc.price * (1 - pct / 100)).toFixed(2);
                }
                return next;
              });
            }}
            className={`${selectCls} w-full text-sm`}
          >
            <option value="">— Seleccionar —</option>
            {services.filter((s) => !newRow.tipoServicio || s.category === newRow.tipoServicio).map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Operadora</span>
          <select
            value={newRow.professionalId}
            onChange={(e) => {
              const prof = professionals.find((p) => p.id === e.target.value);
              setNewRow((p) => ({ ...p, professionalId: e.target.value, operadora: prof?.name ?? p.operadora }));
            }}
            className={`${selectCls} w-full text-sm`}
          >
            <option value="">— Profesional —</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-0.5 text-xs col-span-1">
            <span className="text-gray-500">Lista</span>
            <input type="number" value={newRow.montoLista} onChange={(e) => updateNewRow("montoLista", e.target.value)} className={`${inputCls} w-full text-sm`} min="0" step="0.01" placeholder="0" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs col-span-1">
            <span className="text-gray-500">Desc %</span>
            <input type="number" value={newRow.descuentoPct} onChange={(e) => updateNewRow("descuentoPct", e.target.value)} className={`${inputCls} w-full text-sm`} min="0" max="100" placeholder="0" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs col-span-1">
            <span className="text-gray-500">Cobrado</span>
            <input type="number" value={newRow.montoCobrado} onChange={(e) => updateNewRow("montoCobrado", e.target.value)} className={`${inputCls} w-full text-sm`} min="0" step="0.01" placeholder="0" />
          </label>
        </div>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Método de pago</span>
          <select value={newRow.metodoPago} onChange={(e) => updateNewRow("metodoPago", e.target.value)} className={`${selectCls} w-full text-sm`}>
            {METODOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        {showNewBanco && (
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-gray-500">Banco</span>
            <input type="text" value={newRow.banco} onChange={(e) => updateNewRow("banco", e.target.value)} className={`${inputCls} w-full text-sm`} placeholder="Ej: Galicia" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-gray-500">Sesión N°</span>
            <input type="number" value={newRow.sesionN} onChange={(e) => updateNewRow("sesionN", e.target.value)} className={`${inputCls} w-full text-sm`} min="1" placeholder="—" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-gray-500">De</span>
            <input type="number" value={newRow.sesionTotal} onChange={(e) => updateNewRow("sesionTotal", e.target.value)} className={`${inputCls} w-full text-sm`} min="1" placeholder="—" />
          </label>
        </div>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Notas</span>
          <input type="text" value={newRow.notas} onChange={(e) => updateNewRow("notas", e.target.value)} className={`${inputCls} w-full text-sm`} placeholder="Observaciones..." />
        </label>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleSubmitNew()}
            disabled={submittingNew}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submittingNew ? "Registrando..." : "+ Registrar sesión"}
          </button>
          <button
            type="button"
            onClick={() => setShowMobileCreate(false)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ─── Desktop table ─────────────────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="pb-2 pr-4">Cliente</th>
              <th className="pb-2 pr-4">Servicio</th>
              <th className="pb-2 pr-4">Operadora</th>
              <th className="pb-2 pr-4">Cobrado</th>
              <th className="pb-2 pr-4">Método</th>
              <th className="pb-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map((row) => {
              const editing = isEditing(row);
              return editing ? (
                <Fragment key={row.id}>
                  <tr className="bg-blue-50">
                    {/* Cliente */}
                    <td className="py-2 pr-4 align-top pt-3">
                      <ClientCombobox
                        value={editData!.client_name}
                        clientId={editData!.client_id}
                        onChange={(id, name) => setEditData((prev) => prev ? { ...prev, client_id: id, client_name: name } : prev)}
                        className={`${inputCls} w-36`}
                      />
                    </td>
                    {/* Servicio */}
                    <td className="py-2 pr-3 align-top pt-3">
                      <select
                        value={editData!.tipo_servicio}
                        onChange={(e) => updateField("tipo_servicio", e.target.value)}
                        className={`${selectCls} w-full mb-1`}
                      >
                        {serviceCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select
                        value={editData!.descripcion}
                        onChange={(e) => {
                          const svc = services.find((s) => s.name === e.target.value);
                          updateField("descripcion", e.target.value);
                          if (svc && editData!.monto_lista === "") updateField("monto_lista", String(svc.price));
                        }}
                        className={`${selectCls} w-full`}
                      >
                        <option value="">— Servicio —</option>
                        {services.filter((s) => !editData!.tipo_servicio || s.category === editData!.tipo_servicio).map((s) => (
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
                          setEditData((prev) => prev ? { ...prev, professional_id: e.target.value, operadora: prof?.name ?? prev.operadora } : prev);
                        }}
                        className={`${selectCls} w-full mb-1`}
                      >
                        <option value="">— Profesional —</option>
                        {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input
                        type="text"
                        value={editData!.operadora}
                        onChange={(e) => updateField("operadora", e.target.value)}
                        placeholder="Operadora"
                        className={`${inputCls} w-full`}
                      />
                    </td>
                    {/* Cobrado */}
                    <td className="py-2 pr-3 align-top pt-3">
                      {row.isPendingBooking && (
                        <input
                          type="time"
                          value={editData!.hora}
                          onChange={(e) => updateField("hora", e.target.value)}
                          className={`${inputCls} w-20 mb-1 block`}
                        />
                      )}
                      <input
                        type="number"
                        value={editData!.monto_cobrado}
                        onChange={(e) => updateField("monto_cobrado", e.target.value)}
                        placeholder="Cobrado"
                        className={`${inputCls} w-24`}
                        min="0" step="0.01"
                      />
                    </td>
                    {/* Método */}
                    <td className="py-2 pr-3 align-top pt-3">
                      <select
                        value={editData!.metodo_pago}
                        onChange={(e) => updateField("metodo_pago", e.target.value)}
                        className={`${selectCls} w-full`}
                      >
                        {METODOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </td>
                    {/* Acciones */}
                    <td className="py-2 align-top pt-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => saveEdit(row)}
                          disabled={saving}
                          className="rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {row.isPendingBooking ? "Confirmar" : "✓"}
                        </button>
                        <button onClick={cancelEdit} className="rounded-lg bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors">✕</button>
                      </div>
                    </td>
                  </tr>
                  {/* Secondary fields sub-row */}
                  <tr className="bg-blue-50 border-t-0">
                    <td colSpan={6} className="pb-3 pt-0 px-0">
                      <div className="flex flex-wrap gap-3 px-2 text-xs items-end">
                        {renderEditFields(row)}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ) : (
                <tr key={row.id} className={row.isPendingBooking ? "bg-amber-50" : ""}>
                  {/* Cliente */}
                  <td className="py-2 pr-4">
                    <div className="font-medium text-gray-900">{row.clientName}</div>
                    {row.time && <div className="text-xs text-gray-400">{row.time}</div>}
                  </td>
                  {/* Servicio */}
                  <td className="py-2 pr-4 text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <span>{row.tipoServicio}</span>
                      {row.sesionN != null && row.sesionTotal != null && (
                        <span className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 px-1.5 py-0.5 text-[10px] font-medium">
                          {row.sesionN}/{row.sesionTotal}
                        </span>
                      )}
                    </div>
                    {row.descripcion && <div className="text-xs text-gray-400">{row.descripcion}</div>}
                  </td>
                  {/* Operadora */}
                  <td className="py-2 pr-4 text-gray-600">{row.operadora ?? "—"}</td>
                  {/* Cobrado */}
                  <td className="py-2 pr-4 text-gray-700">
                    {row.montoCobrado != null ? (
                      <span title={
                        row.montoLista != null
                          ? `Lista: ${formatCurrency(row.montoLista)}${row.descuentoPct ? ` (-${row.descuentoPct}%)` : ""}`
                          : undefined
                      } className={row.montoLista != null ? "underline decoration-dotted cursor-help" : ""}>
                        {formatCurrency(row.montoCobrado)}
                      </span>
                    ) : "—"}
                  </td>
                  {/* Método */}
                  <td className="py-2 pr-4 text-gray-600">{row.metodoPago?.replace(/_/g, " ") ?? "—"}</td>
                  {/* Acciones */}
                  <td className="py-2">
                    {canEdit(row) ? (
                      <div className="flex items-center gap-1">
                        {row.notas && (
                          <span title={row.notas} className="text-amber-500 cursor-help mr-0.5">
                            <StickyNote size={13} />
                          </span>
                        )}
                        <button
                          onClick={() => startEdit(row)}
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

            {/* ── Inline creation row (always visible) ── */}
            <tr className="border-t-2 border-dashed border-emerald-300 bg-emerald-50/40">
              {/* Cliente */}
              <td className="py-2 pr-3 align-top pt-2.5">
                <ClientCombobox
                  key={newClientKey}
                  value={newRow.clientLabel}
                  clientId={newRow.clientId}
                  onChange={(id, label) => setNewRow((p) => ({ ...p, clientId: id, clientLabel: label }))}
                  className={`${inputCls} w-full min-w-[140px]`}
                  placeholder="Cliente..."
                  inputRef={newClientRef}
                  onCreateNew={openCreateClient}
                />
              </td>
              {/* Servicio */}
              <td className="py-2 pr-3 align-top pt-2.5">
                <select
                  value={newRow.tipoServicio}
                  onChange={(e) => updateNewRow("tipoServicio", e.target.value)}
                  className={`${selectCls} w-full mb-1`}
                >
                  <option value="">Servicio...</option>
                  {serviceCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={newRow.descripcion}
                  onChange={(e) => {
                    const svc = services.find((s) => s.name === e.target.value);
                    setNewRow((p) => {
                      const next = { ...p, descripcion: e.target.value };
                      if (svc && !p.montoLista) {
                        next.montoLista = String(svc.price);
                        const pct = parseFloat(p.descuentoPct);
                        next.montoCobrado = isNaN(pct) ? String(svc.price) : (svc.price * (1 - pct / 100)).toFixed(2);
                      }
                      return next;
                    });
                  }}
                  className={`${selectCls} w-full`}
                >
                  <option value="">— Específico —</option>
                  {services.filter((s) => !newRow.tipoServicio || s.category === newRow.tipoServicio).map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </td>
              {/* Operadora */}
              <td className="py-2 pr-3 align-top pt-2.5">
                <select
                  value={newRow.professionalId}
                  onChange={(e) => {
                    const prof = professionals.find((p) => p.id === e.target.value);
                    setNewRow((p) => ({ ...p, professionalId: e.target.value, operadora: prof?.name ?? p.operadora }));
                  }}
                  className={`${selectCls} w-full`}
                >
                  <option value="">— Operadora —</option>
                  {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
              {/* Cobrado */}
              <td className="py-2 pr-3 align-top pt-2.5">
                <input
                  type="number"
                  value={newRow.montoCobrado}
                  onChange={(e) => updateNewRow("montoCobrado", e.target.value)}
                  placeholder="$"
                  className={`${inputCls} w-24`}
                  min="0" step="0.01"
                />
              </td>
              {/* Método */}
              <td className="py-2 pr-3 align-top pt-2.5">
                <select
                  value={newRow.metodoPago}
                  onChange={(e) => updateNewRow("metodoPago", e.target.value)}
                  className={`${selectCls} w-full`}
                >
                  {METODOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </td>
              {/* Submit + expand */}
              <td className="py-2 align-top pt-2.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSubmitNew()}
                    disabled={submittingNew}
                    title="Registrar sesión"
                    className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {submittingNew ? "..." : "+"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRowExpanded((v) => !v)}
                    title={newRowExpanded ? "Ocultar campos extras" : "Más campos"}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    {newRowExpanded ? "↑" : "↓"}
                  </button>
                </div>
              </td>
            </tr>

            {/* Expansion sub-row for secondary fields */}
            {newRowExpanded && (
              <tr className="bg-emerald-50/20 border-t-0">
                <td colSpan={6} className="pb-3 pt-1 px-0">
                  <div className="flex flex-wrap gap-3 px-2 text-xs items-end">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Monto lista</span>
                      <input type="number" value={newRow.montoLista} onChange={(e) => updateNewRow("montoLista", e.target.value)} placeholder="—" className={`${inputCls} w-24`} min="0" step="0.01" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Desc. %</span>
                      <input type="number" value={newRow.descuentoPct} onChange={(e) => updateNewRow("descuentoPct", e.target.value)} placeholder="—" className={`${inputCls} w-16`} min="0" max="100" />
                    </label>
                    {showNewBanco && (
                      <label className="flex flex-col gap-0.5">
                        <span className="text-gray-500">Banco</span>
                        <input type="text" value={newRow.banco} onChange={(e) => updateNewRow("banco", e.target.value)} placeholder="Banco" className={`${inputCls} w-28`} />
                      </label>
                    )}
                    <label className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Sesión N°</span>
                      <input type="number" value={newRow.sesionN} onChange={(e) => updateNewRow("sesionN", e.target.value)} placeholder="—" className={`${inputCls} w-14`} min="1" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-gray-500">De</span>
                      <input type="number" value={newRow.sesionTotal} onChange={(e) => updateNewRow("sesionTotal", e.target.value)} placeholder="—" className={`${inputCls} w-14`} min="1" />
                    </label>
                    <label className="flex flex-col gap-0.5 flex-1 min-w-40">
                      <span className="text-gray-500">Notas</span>
                      <input type="text" value={newRow.notas} onChange={(e) => updateNewRow("notas", e.target.value)} placeholder="Notas" className={`${inputCls} w-full`} />
                    </label>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {/* ── Daily summary footer ── */}
          {sessions.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50/60">
                <td colSpan={3} className="py-2 px-0 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">
                    {confirmedSessions.length} sesión{confirmedSessions.length !== 1 ? "es" : ""}
                  </span>
                  {pendingCount > 0 && (
                    <span className="ml-1 text-amber-600">(+ {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""})</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-sm font-bold text-gray-900">
                  {formatCurrency(totalCobrado)}
                </td>
                <td colSpan={2} className="py-2 text-xs text-gray-500">
                  {Object.entries(byMethod).map(([method, count], i) => (
                    <span key={method}>
                      {i > 0 && <span className="mx-1 text-gray-300">·</span>}
                      <span className="font-medium text-gray-700">{count}</span> {method}
                    </span>
                  ))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ─── Mobile cards ───────────────────────────────────────────────────── */}
      <div className="sm:hidden">
        {/* Daily summary bar */}
        {sessions.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 mb-3 text-xs">
            <span className="text-gray-600">
              <span className="font-medium text-gray-800">{confirmedSessions.length}</span> sesiones
              {pendingCount > 0 && <span className="ml-1 text-amber-600">(+{pendingCount})</span>}
            </span>
            <span className="font-bold text-gray-900">{formatCurrency(totalCobrado)}</span>
          </div>
        )}

        <div className="space-y-3">
          {sessions.map((row) => {
            const editing = isEditing(row);
            return (
              <div
                key={row.id}
                className={`rounded-lg border p-3 space-y-2 ${
                  row.isPendingBooking && !editing ? "border-amber-200 bg-amber-50"
                    : editing ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{editing ? editData!.client_name : row.clientName}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                      {row.time && <span>{row.time}</span>}
                      <span>{row.tipoServicio}</span>
                      {row.sesionN != null && row.sesionTotal != null && (
                        <span className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 px-1.5 py-0.5 text-[10px] font-medium">
                          {row.sesionN}/{row.sesionTotal}
                        </span>
                      )}
                    </div>
                    {row.descripcion && !editing && <div className="text-xs text-gray-400">{row.descripcion}</div>}
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-2 pt-1">
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Cliente</span>
                      <ClientCombobox
                        value={editData!.client_name}
                        clientId={editData!.client_id}
                        onChange={(id, name) => setEditData((prev) => prev ? { ...prev, client_id: id, client_name: name } : prev)}
                        className={`${inputCls} w-full text-sm`}
                      />
                    </label>
                    {row.isPendingBooking && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-0.5 text-xs">
                          <span className="text-gray-500">Fecha</span>
                          <input type="date" value={editData!.fecha} onChange={(e) => updateField("fecha", e.target.value)} className={`${inputCls} text-sm`} />
                        </label>
                        <label className="flex flex-col gap-0.5 text-xs">
                          <span className="text-gray-500">Hora</span>
                          <input type="time" value={editData!.hora} onChange={(e) => updateField("hora", e.target.value)} className={`${inputCls} text-sm`} />
                        </label>
                      </div>
                    )}
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Categoría</span>
                      <select value={editData!.tipo_servicio} onChange={(e) => updateField("tipo_servicio", e.target.value)} className={`${selectCls} text-sm`}>
                        {serviceCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Servicio</span>
                      <select value={editData!.descripcion} onChange={(e) => { const svc = services.find((s) => s.name === e.target.value); updateField("descripcion", e.target.value); if (svc && editData!.monto_lista === "") updateField("monto_lista", String(svc.price)); }} className={`${selectCls} text-sm`}>
                        <option value="">— Seleccionar —</option>
                        {services.filter((s) => !editData!.tipo_servicio || s.category === editData!.tipo_servicio).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Profesional</span>
                      <select value={editData!.professional_id} onChange={(e) => { const prof = professionals.find((p) => p.id === e.target.value); setEditData((prev) => prev ? { ...prev, professional_id: e.target.value, operadora: prof?.name ?? prev.operadora } : prev); }} className={`${selectCls} text-sm`}>
                        <option value="">— Profesional —</option>
                        {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Lista</span>
                        <input type="number" value={editData!.monto_lista} onChange={(e) => updateField("monto_lista", e.target.value)} className={`${inputCls} text-sm`} min="0" step="0.01" />
                      </label>
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Desc. %</span>
                        <input type="number" value={editData!.descuento_pct} onChange={(e) => updateField("descuento_pct", e.target.value)} className={`${inputCls} text-sm`} min="0" max="100" />
                      </label>
                    </div>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Cobrado</span>
                      <input type="number" value={editData!.monto_cobrado} onChange={(e) => updateField("monto_cobrado", e.target.value)} className={`${inputCls} text-sm`} min="0" step="0.01" />
                    </label>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Método de pago</span>
                      <select value={editData!.metodo_pago} onChange={(e) => updateField("metodo_pago", e.target.value)} className={`${selectCls} text-sm`}>
                        {METODOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </label>
                    {showEditBanco && (
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Banco</span>
                        <input type="text" value={editData!.banco} onChange={(e) => updateField("banco", e.target.value)} className={`${inputCls} text-sm`} />
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">Sesión N°</span>
                        <input type="number" value={editData!.sesion_n} onChange={(e) => updateField("sesion_n", e.target.value)} className={`${inputCls} text-sm`} min="1" />
                      </label>
                      <label className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-500">De</span>
                        <input type="number" value={editData!.sesion_total_cuponera} onChange={(e) => updateField("sesion_total_cuponera", e.target.value)} className={`${inputCls} text-sm`} min="1" />
                      </label>
                    </div>
                    <label className="flex flex-col gap-0.5 text-xs">
                      <span className="text-gray-500">Notas</span>
                      <input type="text" value={editData!.notas} onChange={(e) => updateField("notas", e.target.value)} className={`${inputCls} text-sm`} />
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => saveEdit(row)} disabled={saving} className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                        {row.isPendingBooking ? "Confirmar sesión" : "Guardar"}
                      </button>
                      <button onClick={cancelEdit} className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      {row.montoCobrado != null && (
                        <span className="font-medium" title={row.montoLista != null ? `Lista: ${formatCurrency(row.montoLista)}${row.descuentoPct ? ` (-${row.descuentoPct}%)` : ""}` : undefined}>
                          {formatCurrency(row.montoCobrado)}
                        </span>
                      )}
                      {row.metodoPago && <span>{row.metodoPago.replace(/_/g, " ")}</span>}
                      {row.operadora && <span>{row.operadora}</span>}
                      {row.notas && <span title={row.notas}><StickyNote size={12} className="text-amber-500" /></span>}
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
                          <button onClick={() => handleDelete(row)} disabled={deletingId === row.id} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
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

        {/* Mobile creation card */}
        {showMobileCreate && (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50/40 p-3">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Nueva sesión</h3>
            {renderMobileNewForm()}
          </div>
        )}

        {/* Sticky bottom bar */}
        <div className="sticky bottom-0 left-0 right-0 mt-3 bg-card border-t border-border px-0 pt-3 pb-2">
          {!showMobileCreate && (
            <button
              onClick={() => setShowMobileCreate(true)}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + Nueva sesión
            </button>
          )}
        </div>
      </div>

      {/* ─── Quick create client modal ─────────────────────────────────────── */}
      <Modal open={showCreateClient} onClose={() => setShowCreateClient(false)} title="Crear cliente">
        <form onSubmit={handleCreateClient} className="space-y-3">
          <p className="text-xs text-muted-foreground">Creando: &ldquo;{createClientQuery}&rdquo;</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
              <input type="text" value={ncFirstName} onChange={(e) => setNcFirstName(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Apellido *</label>
              <input type="text" value={ncLastName} onChange={(e) => setNcLastName(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono *</label>
            <input type="text" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} required placeholder="5491112345678" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Instagram</label>
              <input type="text" value={ncInstagram} onChange={(e) => setNcInstagram(e.target.value)} placeholder="@usuario" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Origen</label>
              <select value={ncSource} onChange={(e) => setNcSource(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">Seleccionar...</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {ncSource === "Referido" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Referido por</label>
              <input type="text" value={ncReferidoPor} onChange={(e) => setNcReferidoPor(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowCreateClient(false)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={creatingClient} className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60">
              {creatingClient ? "Creando..." : "Crear cliente"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
