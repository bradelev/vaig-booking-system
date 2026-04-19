"use client";

import { useState } from "react";
import Link from "next/link";
import Combobox, { type ComboboxItem } from "@/components/backoffice/agenda/combobox";
import ValidatedForm from "@/components/backoffice/validated-form";
import { createBooking, quickCreateClient } from "@/actions/citas";

interface Cliente {
  id: string;
  first_name: string;
  last_name: string;
}

interface Servicio {
  id: string;
  name: string;
}

interface Profesional {
  id: string;
  name: string;
}

interface NuevaCitaFormProps {
  clientes: Cliente[];
  servicios: Servicio[];
  profesionales: Profesional[];
  defaultDatetime: string;
}

export default function NuevaCitaForm({
  clientes,
  servicios,
  profesionales,
  defaultDatetime,
}: NuevaCitaFormProps) {
  const [allClients, setAllClients] = useState<Cliente[]>(clientes);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientFirst, setNewClientFirst] = useState("");
  const [newClientLast, setNewClientLast] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [clientCreating, setClientCreating] = useState(false);

  const clientItems: ComboboxItem[] = allClients.map((c) => ({
    id: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const serviceItems: ComboboxItem[] = servicios.map((s) => ({
    id: s.id,
    label: s.name,
  }));

  const professionalItems: ComboboxItem[] = profesionales.map((p) => ({
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
    setAllClients((prev) => [
      ...prev,
      { id: result.id, first_name: result.first_name, last_name: result.last_name },
    ]);
    setClientId(result.id);
    setShowNewClient(false);
    setNewClientFirst("");
    setNewClientLast("");
    setNewClientPhone("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!clientId || !serviceId) {
      e.preventDefault();
      setError("Cliente y servicio son obligatorios.");
      return;
    }
    setError(null);
  }

  return (
    <ValidatedForm
      action={createBooking}
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-6 shadow-sm space-y-5"
    >
      {/* Hidden inputs for combobox values */}
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="professional_id" value={professionalId} />

      <div>
        <label className="block text-sm font-medium text-gray-700">Cliente *</label>
        <div className="mt-1">
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
                  disabled={
                    clientCreating ||
                    !newClientFirst.trim() ||
                    !newClientLast.trim() ||
                    !newClientPhone.trim()
                  }
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {clientCreating ? "Creando..." : "Crear"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Servicio *</label>
        <div className="mt-1">
          <Combobox
            items={serviceItems}
            value={serviceId}
            onChange={(id) => setServiceId(id)}
            placeholder="Buscar servicio..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Profesional</label>
        <div className="mt-1">
          <Combobox
            items={professionalItems}
            value={professionalId}
            onChange={(id) => setProfessionalId(id)}
            placeholder="Sin asignar..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Fecha y hora *</label>
        <input
          name="scheduled_at"
          type="datetime-local"
          required
          defaultValue={defaultDatetime}
          onClick={(e) => {
            const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
            el.showPicker?.();
          }}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notas</label>
        <textarea
          name="notes"
          rows={3}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Link
          href="/backoffice/citas"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Crear cita
        </button>
      </div>
    </ValidatedForm>
  );
}
