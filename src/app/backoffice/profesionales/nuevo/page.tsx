import Link from "next/link";
import { createProfessional } from "@/actions/profesionales";
import ValidatedForm from "@/components/backoffice/validated-form";

export default function NuevoProfesionalPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/backoffice/profesionales" className="text-sm text-gray-500 hover:text-gray-800">
          ← Profesionales
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo profesional</h1>
      </div>

      <ValidatedForm action={createProfessional} className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            name="name"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Teléfono</label>
          <input
            name="phone"
            type="tel"
            placeholder="5491112345678"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">Formato internacional sin + (para recordatorios WA)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Especialidades</label>
          <input
            name="specialties"
            placeholder="Ej: Masajes, Reflexología, Reiki"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">Separadas por coma</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/backoffice/profesionales"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Crear profesional
          </button>
        </div>
      </ValidatedForm>
    </div>
  );
}
