"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBookingFromAgenda, quickCreateClient, quickCreateService } from "@/actions/citas";
import type { Client, Service, Professional } from "./agenda-types";
import Combobox, { type ComboboxItem } from "./combobox";

interface CreateBookingModalProps {
  slot: { date: Date; hour: number; minute: number };
  clients: Client[];
  services: Service[];
  professionals: Professional[];
  onClose: () => void;
}

function toLocalISOString(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00-03:00`;
}

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeInput(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function CreateBookingModal({
  slot,
  clients: initialClients,
  services: initialServices,
  professionals,
  onClose,
}: CreateBookingModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Date/time editable state
  const [dateInput, setDateInput] = useState(formatDateInput(slot.date));
  const [timeInput, setTimeInput] = useState(formatTimeInput(slot.hour, slot.minute));

  // Client state
  const [allClients, setAllClients] = useState<Client[]>(initialClients);
  const [clientId, setClientId] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientFirst, setNewClientFirst] = useState("");
  const [newClientLast, setNewClientLast] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [clientCreating, setClientCreating] = useState(false);

  // Service state
  const [allServices, setAllServices] = useState<Service[]>(initialServices);
  const [serviceId, setServiceId] = useState("");
  const [showNewService, setShowNewService] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(60);
  const [newServicePrice, setNewServicePrice] = useState(0);
  const [newServiceDeposit, setNewServiceDeposit] = useState(0);
  const [serviceCreating, setServiceCreating] = useState(false);

  const [professionalId, setProfessionalId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clientItems: ComboboxItem[] = allClients.map((c) => ({
    id: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const serviceItems: ComboboxItem[] = allServices.map((s) => ({
    id: s.id,
    label: `${s.name} (${s.duration_minutes} min)`,
  }));

  const professionalItems: ComboboxItem[] = professionals.map((p) => ({
    id: p.id,
    label: p.name,
  }));

  async function handleCreateClient() {
    if (!newClientFirst.trim() || !newClientLast.trim() || !newClientPhone.trim()) return;
    setClientCreating(true);
    const result = await quickCreateClient({
      first_name: newClientFirst,
      last_name: newClientLast,
      phone: newClientPhone,
    });
    setClientCreating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const newClient: Client = {
      id: result.id,
      first_name: result.first_name,
      last_name: result.last_name,
    };
    setAllClients((prev) => [...prev, newClient]);
    setClientId(result.id);
    setShowNewClient(false);
    setNewClientFirst("");
    setNewClientLast("");
    setNewClientPhone("");
  }

  async function handleCreateService() {
    if (!newServiceName.trim()) return;
    setServiceCreating(true);
    const result = await quickCreateService({
      name: newServiceName,
      duration_minutes: newServiceDuration,
      price: newServicePrice,
      deposit_amount: newServiceDeposit,
    });
    setServiceCreating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const newService: Service = {
      id: result.id,
      name: result.name,
      duration_minutes: result.duration_minutes,
    };
    setAllServices((prev) => [...prev, newService]);
    setServiceId(result.id);
    setShowNewService(false);
    setNewServiceName("");
    setNewServiceDuration(60);
    setNewServicePrice(0);
    setNewServiceDeposit(0);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !serviceId) {
      setError("Cliente y servicio son obligatorios.");
      return;
    }
    if (!dateInput || !timeInput) {
      setError("Fecha y hora son obligatorias.");
      return;
    }
    setError(null);
    const scheduledAt = toLocalISOString(dateInput, timeInput);
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
        <h2 className="mb-4 text-base font-semibold text-gray-900">Nuevo turno</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Date and time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha *</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                required
              />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-sm font-medium text-gray-700">Hora *</label>
              <input
                type="time"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                required
              />
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cliente *</label>
            <Combobox
              items={clientItems}
              value={clientId}
              onChange={(id) => setClientId(id)}
              onCreateNew={(q) => {
                setNewClientFirst(q);
                setNewClientLast("");
                setShowNewClient(true);
              }}
              placeholder="Buscar cliente..."
            />
            {showNewClient && (
              <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                <p className="text-xs font-medium text-blue-700">Nuevo cliente</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newClientFirst}
                    onChange={(e) => setNewClientFirst(e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newClientLast}
                    onChange={(e) => setNewClientLast(e.target.value)}
                    placeholder="Apellido"
                    className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                  />
                </div>
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="Teléfono (ej: 5491112345678)"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewClient(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateClient}
                    disabled={clientCreating || !newClientFirst.trim() || !newClientLast.trim() || !newClientPhone.trim()}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {clientCreating ? "Creando..." : "Crear"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Servicio */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Servicio *</label>
            <Combobox
              items={serviceItems}
              value={serviceId}
              onChange={(id) => setServiceId(id)}
              onCreateNew={(q) => {
                setNewServiceName(q);
                setNewServiceDuration(60);
                setShowNewService(true);
              }}
              placeholder="Buscar servicio..."
            />
            {showNewService && (
              <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                <p className="text-xs font-medium text-blue-700">Nuevo servicio</p>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Nombre del servicio"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600">Duración (min)</label>
                    <input
                      type="number"
                      value={newServiceDuration}
                      onChange={(e) => setNewServiceDuration(Number(e.target.value))}
                      min={5}
                      max={480}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600">Precio</label>
                    <input
                      type="number"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(Number(e.target.value))}
                      min={0}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600">Seña</label>
                    <input
                      type="number"
                      value={newServiceDeposit}
                      onChange={(e) => setNewServiceDeposit(Number(e.target.value))}
                      min={0}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewService(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateService}
                    disabled={serviceCreating || !newServiceName.trim()}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {serviceCreating ? "Creando..." : "Crear"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profesional */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Profesional</label>
            <Combobox
              items={professionalItems}
              value={professionalId}
              onChange={(id) => setProfessionalId(id)}
              placeholder="Sin asignar..."
            />
          </div>

          {/* Notas */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notas <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-400"
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
