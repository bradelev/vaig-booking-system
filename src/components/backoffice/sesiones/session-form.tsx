"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import Combobox, { ComboboxItem } from "@/components/backoffice/agenda/combobox";
import ClientSearchCombobox from "./client-search-combobox";
import { createSession, quickCreateClientForSession } from "@/actions/sesiones";
import Modal from "@/components/backoffice/modal";

const METODOS_PAGO = [
  "Transferencia",
  "Efectivo",
  "Mercado_Pago",
  "Pos_débito",
  "Pos_crédito",
  "Cuponera",
  "Canje",
  "Regalo",
] as const;

const METODOS_CON_BANCO = new Set(["Transferencia", "Pos_débito", "Pos_crédito"]);

const SOURCES = ["Instagram", "Referido", "Enfoque", "WeFitness", "Google", "Ruleta", "Otro"] as const;

export interface Professional {
  id: string;
  name: string;
}

interface SessionFormProps {
  professionals: Professional[];
  serviceCategories: string[];
  initialDate: string;
  onDateChange: (date: string) => void;
}

function todayAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function SessionForm({
  professionals,
  serviceCategories,
  initialDate,
  onDateChange,
}: SessionFormProps) {
  const [fecha, setFecha] = useState(initialDate || todayAR());
  const [operadora, setOperadora] = useState("");
  const [professionalId, setProfessionalId] = useState("");

  const [clientId, setClientId] = useState("");
  const [clientLabel, setClientLabel] = useState("");
  const [clientKey, setClientKey] = useState(0);

  const [tipoServicio, setTipoServicio] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [montoLista, setMontoLista] = useState("");
  const [descuentoPct, setDescuentoPct] = useState("");
  const [montoCobrado, setMontoCobrado] = useState("");

  const [metodoPago, setMetodoPago] = useState("");
  const [banco, setBanco] = useState("");

  const [sesionN, setSesionN] = useState("");
  const [sesionTotal, setSesionTotal] = useState("");
  const [notas, setNotas] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);

  // New client form state
  const [ncFirstName, setNcFirstName] = useState("");
  const [ncLastName, setNcLastName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncInstagram, setNcInstagram] = useState("");
  const [ncSource, setNcSource] = useState("");
  const [ncReferidoPor, setNcReferidoPor] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  // Auto-compute monto cobrado from lista - descuento
  useEffect(() => {
    const lista = parseFloat(montoLista);
    const pct = parseFloat(descuentoPct);
    if (!isNaN(lista) && !isNaN(pct)) {
      setMontoCobrado((lista * (1 - pct / 100)).toFixed(2));
    }
  }, [montoLista, descuentoPct]);

  function setDate(d: string) {
    setFecha(d);
    onDateChange(d);
  }

  const resetForm = useCallback(() => {
    setClientId("");
    setClientLabel("");
    setClientKey((k) => k + 1);
    setTipoServicio("");
    setDescripcion("");
    setMontoLista("");
    setDescuentoPct("");
    setMontoCobrado("");
    setMetodoPago("");
    setBanco("");
    setSesionN("");
    setSesionTotal("");
    setNotas("");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { toast.error("Seleccioná un cliente"); return; }
    if (!tipoServicio) { toast.error("Seleccioná el tipo de servicio"); return; }

    setSubmitting(true);
    const result = await createSession({
      client_id: clientId,
      fecha,
      tipo_servicio: tipoServicio,
      descripcion: descripcion || undefined,
      operadora: operadora || undefined,
      professional_id: professionalId || undefined,
      monto_lista: montoLista ? parseFloat(montoLista) : undefined,
      descuento_pct: descuentoPct ? parseFloat(descuentoPct) : undefined,
      monto_cobrado: montoCobrado ? parseFloat(montoCobrado) : undefined,
      metodo_pago: metodoPago || undefined,
      banco: banco || undefined,
      sesion_n: sesionN ? parseInt(sesionN) : undefined,
      sesion_total_cuponera: sesionTotal ? parseInt(sesionTotal) : undefined,
      notas: notas || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      toast.success("Sesión registrada");
      resetForm();
    } else {
      toast.error(result.error ?? "Error al registrar");
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
      setClientId(result.id);
      setClientLabel(label);
      setClientKey((k) => k + 1);
      setShowCreateClient(false);
      setNcFirstName(""); setNcLastName(""); setNcPhone("");
      setNcInstagram(""); setNcSource(""); setNcReferidoPor("");
      toast.success("Cliente creado");
    }
  }

  const professionalItems: ComboboxItem[] = professionals.map((p) => ({
    id: p.id,
    label: p.name,
  }));

  const showBanco = METODOS_CON_BANCO.has(metodoPago as typeof METODOS_PAGO[number]);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Fila 1: Fecha + Operadora */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDate(addDays(fecha, -1))}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-50"
                aria-label="Día anterior"
              >
                ‹
              </button>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <button
                type="button"
                onClick={() => setDate(addDays(fecha, 1))}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-50"
                aria-label="Día siguiente"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setDate(todayAR())}
                className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
              >
                Hoy
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Atendido por</label>
            <Combobox
              key={`prof-${professionalId}`}
              items={professionalItems}
              value={professionalId}
              onChange={(id, label) => {
                setProfessionalId(id);
                setOperadora(id ? label : operadora);
              }}
              placeholder="Seleccionar profesional..."
            />
            {!professionalId && (
              <input
                type="text"
                value={operadora}
                onChange={(e) => setOperadora(e.target.value)}
                placeholder="O escribí el nombre libre"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            )}
          </div>
        </div>

        {/* Fila 2: Cliente */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Cliente *</label>
          <ClientSearchCombobox
            key={clientKey}
            value={clientId}
            selectedLabel={clientLabel}
            onChange={(id, label) => { setClientId(id); setClientLabel(label); }}
            onCreateNew={(query) => {
              const parts = query.split(" ");
              setNcFirstName(parts[0] ?? "");
              setNcLastName(parts.slice(1).join(" ") ?? "");
              setShowCreateClient(true);
            }}
            placeholder="Buscar por nombre..."
          />
        </div>

        {/* Fila 3: Tipo de servicio + Descripción */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de servicio *</label>
            <select
              value={tipoServicio}
              onChange={(e) => setTipoServicio(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <option value="">Seleccionar...</option>
              {serviceCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Depilación láser piernas"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
        </div>

        {/* Fila 4: Montos */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Monto lista</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={montoLista}
              onChange={(e) => setMontoLista(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descuento %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={descuentoPct}
              onChange={(e) => setDescuentoPct(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Monto cobrado</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={montoCobrado}
              onChange={(e) => setMontoCobrado(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
        </div>

        {/* Fila 5: Método de pago + Banco */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Método de pago</label>
            <select
              value={metodoPago}
              onChange={(e) => {
                setMetodoPago(e.target.value);
                if (!METODOS_CON_BANCO.has(e.target.value as typeof METODOS_PAGO[number])) setBanco("");
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <option value="">Seleccionar...</option>
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          {showBanco && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Banco</label>
              <input
                type="text"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Ej: Galicia"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          )}
        </div>

        {/* Fila 6: Sesión N° + De + Notas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sesión N°</label>
            <input
              type="number"
              min="1"
              value={sesionN}
              onChange={(e) => setSesionN(e.target.value)}
              placeholder="1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">De (total)</label>
            <input
              type="number"
              min="1"
              value={sesionTotal}
              onChange={(e) => setSesionTotal(e.target.value)}
              placeholder="10"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 transition-colors"
        >
          {submitting ? "Registrando..." : "Registrar sesión"}
        </button>
      </form>

      {/* Create client modal */}
      <Modal
        open={showCreateClient}
        onClose={() => setShowCreateClient(false)}
        title="Crear cliente"
      >
        <form onSubmit={handleCreateClient} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={ncFirstName}
                onChange={(e) => setNcFirstName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Apellido *</label>
              <input
                type="text"
                value={ncLastName}
                onChange={(e) => setNcLastName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono *</label>
            <input
              type="text"
              value={ncPhone}
              onChange={(e) => setNcPhone(e.target.value)}
              required
              placeholder="5491112345678"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Instagram</label>
              <input
                type="text"
                value={ncInstagram}
                onChange={(e) => setNcInstagram(e.target.value)}
                placeholder="@usuario"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Origen</label>
              <select
                value={ncSource}
                onChange={(e) => setNcSource(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option value="">Seleccionar...</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {ncSource === "Referido" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Referido por</label>
              <input
                type="text"
                value={ncReferidoPor}
                onChange={(e) => setNcReferidoPor(e.target.value)}
                placeholder="Nombre del referidor"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateClient(false)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingClient}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60"
            >
              {creatingClient ? "Creando..." : "Crear cliente"}
            </button>
          </div>
        </form>
      </Modal>

</>
  );
}
