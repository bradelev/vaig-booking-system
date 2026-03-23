"use client";

import { useState, useEffect, useId } from "react";
import { toast } from "sonner";
import Modal from "@/components/backoffice/modal";
import { confirmBookingAsSession } from "@/actions/sesiones";

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

export interface BookingToConfirm {
  id: string;
  clientName: string;
  serviceName: string;
  scheduledAt: string;
  professionalName?: string;
  professionalId?: string;
}

interface ConfirmBookingModalProps {
  booking: BookingToConfirm | null;
  onClose: () => void;
}

export default function ConfirmBookingModal({ booking, onClose }: ConfirmBookingModalProps) {
  const uid = useId();
  const [operadora, setOperadora] = useState("");
  const [montoCobrado, setMontoCobrado] = useState("");
  const [descuentoPct, setDescuentoPct] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [banco, setBanco] = useState("");
  const [sesionN, setSesionN] = useState("");
  const [sesionTotal, setSesionTotal] = useState("");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (booking) {
      setOperadora(booking.professionalName ?? "");
      setMontoCobrado("");
      setDescuentoPct("");
      setMetodoPago("");
      setBanco("");
      setSesionN("");
      setSesionTotal("");
      setNotas("");
    }
  }, [booking]);

  const showBanco = METODOS_CON_BANCO.has(metodoPago as typeof METODOS_PAGO[number]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;

    setSubmitting(true);
    const result = await confirmBookingAsSession(booking.id, {
      operadora: operadora || undefined,
      professional_id: booking.professionalId || undefined,
      monto_cobrado: montoCobrado ? parseFloat(montoCobrado) : undefined,
      descuento_pct: descuentoPct ? parseFloat(descuentoPct) : undefined,
      metodo_pago: metodoPago || undefined,
      banco: banco || undefined,
      sesion_n: sesionN ? parseInt(sesionN) : undefined,
      sesion_total_cuponera: sesionTotal ? parseInt(sesionTotal) : undefined,
      notas: notas || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      toast.success("Sesión confirmada");
      onClose();
    } else {
      toast.error(result.error ?? "Error al confirmar");
    }
  }

  if (!booking) return null;

  const scheduledDate = new Date(booking.scheduledAt);
  const formattedDate = scheduledDate.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <Modal open={!!booking} onClose={onClose} title="Confirmar sesión">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Booking info summary */}
        <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
          <div><span className="font-medium">Cliente:</span> {booking.clientName}</div>
          <div><span className="font-medium">Servicio:</span> {booking.serviceName}</div>
          <div><span className="font-medium">Fecha:</span> {formattedDate}</div>
        </div>

        {/* Operadora */}
        <div>
          <label htmlFor={`${uid}-operadora`} className="block text-xs font-medium text-gray-700 mb-1">Operadora</label>
          <input
            id={`${uid}-operadora`}
            type="text"
            value={operadora}
            onChange={(e) => setOperadora(e.target.value)}
            placeholder="Nombre de la profesional"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>

        {/* Montos */}
        <div className="grid grid-cols-2 gap-3">
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

        {/* Método de pago + Banco */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        {/* Sesión N° / De */}
        <div className="grid grid-cols-2 gap-3">
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
        </div>

        {/* Notas */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Observaciones..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60"
          >
            {submitting ? "Confirmando..." : "Confirmar y registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
