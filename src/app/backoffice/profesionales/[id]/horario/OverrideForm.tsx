"use client";

import { useState } from "react";
import { createScheduleOverride } from "@/actions/schedule";

export default function OverrideForm({ professionalId }: { professionalId: string }) {
  const [isWorking, setIsWorking] = useState(true);

  const action = createScheduleOverride.bind(null, professionalId);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
      <div>
        <label className="block text-sm font-medium text-gray-700">Fecha</label>
        <input
          type="date"
          name="override_date"
          required
          min={minDate}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            name="is_working"
            checked={isWorking}
            onChange={(e) => setIsWorking(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-gray-900"
          />
          Trabaja
        </label>
        {isWorking && (
          <div className="mt-1 flex items-center gap-2">
            <input
              type="time"
              name="start_time"
              defaultValue="09:00"
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            />
            <span className="text-gray-400 text-sm">a</span>
            <input
              type="time"
              name="end_time"
              defaultValue="18:00"
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Motivo</label>
        <input
          type="text"
          name="reason"
          placeholder="Ej: Feriado, turno reducido"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
      >
        Agregar
      </button>
    </form>
  );
}
