"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBookingFromAgenda } from "@/actions/citas";
import type { Client, Service, Professional } from "./agenda-types";

interface CreateBookingModalProps {
  slot: { date: Date; hour: number; minute: number };
  clients: Client[];
  services: Service[];
  professionals: Professional[];
  onClose: () => void;
}

function toLocalISOString(date: Date, hour: number, minute: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:00-03:00`;
}

export default function CreateBookingModal({
  slot,
  clients,
  services,
  professionals,
  onClose,
}: CreateBookingModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scheduledAt = toLocalISOString(slot.date, slot.hour, slot.minute);

  const dateLabel = slot.date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !serviceId) {
      setError("Cliente y servicio son obligatorios.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createBookingFromAgenda({
        client_id: clientId,
        service_id: serviceId,
        professional_id: professionalId || null,
        scheduled_at: scheduledAt,
        notes: notes.trim() || null,
      });
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error ?? "Error al crear el turno.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Nuevo turno</h2>
        <p className="mb-4 text-sm text-gray-500">
          {dateLabel} a las {timeLabel}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cliente *</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Servicio *</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Seleccionar servicio...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes} min)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Profesional</label>
            <select
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notas <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {isPending ? "Creando..." : "Crear turno"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
