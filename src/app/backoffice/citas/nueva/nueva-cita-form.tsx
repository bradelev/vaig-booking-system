"use client";

import { useState } from "react";
import Link from "next/link";
import Combobox, { type ComboboxItem } from "@/components/backoffice/agenda/combobox";
import ValidatedForm from "@/components/backoffice/validated-form";
import { createBooking } from "@/actions/citas";

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
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clientItems: ComboboxItem[] = clientes.map((c) => ({
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
            placeholder="Buscar cliente..."
          />
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
