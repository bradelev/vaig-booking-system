"use client";

import { useState } from "react";
import { createContacto } from "@/actions/contactos";

const CANALES = ["whatsapp", "telefono", "email", "presencial"] as const;

const today = () => new Date().toISOString().split("T")[0];

export default function AddContactoForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);

  const action = createContacto.bind(null, clientId);

  async function handleSubmit(formData: FormData) {
    await action(formData);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        + Nuevo contacto
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-gray-600">Fecha *</label>
          <input
            name="fecha"
            type="date"
            required
            defaultValue={today()}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Canal *</label>
          <select
            name="canal"
            required
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
          >
            {CANALES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Motivo</label>
          <input
            name="motivo"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            placeholder="Ej: seguimiento"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Resultado</label>
          <input
            name="resultado"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            placeholder="Ej: agendó turno"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600">Notas</label>
        <textarea
          name="notas"
          rows={2}
          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}
