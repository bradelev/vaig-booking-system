"use client";

import { useState } from "react";

interface ReactivacionRow {
  id: string;
  nombre: string;
  ultima_visita: string;
  dias_inactivo: number;
  total_sesiones: number;
  phone: string;
  segmento: string;
}

interface ReactivacionTableProps {
  data: ReactivacionRow[];
  currentPage: number;
  totalPages: number;
  periodo: number;
}

function SegmentoBadge({ segmento }: { segmento: string }) {
  const styles: Record<string, string> = {
    Perdida: "bg-gray-100 text-gray-700",
    "En riesgo": "bg-red-100 text-red-700",
    Activa: "bg-green-100 text-green-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[segmento] ?? "bg-gray-100 text-gray-700"}`}
    >
      {segmento}
    </span>
  );
}

export default function ReactivacionTable({
  data,
  currentPage,
  totalPages,
  periodo,
}: ReactivacionTableProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyPhones() {
    const phones = data.map((r) => r.phone).filter(Boolean);
    await navigator.clipboard.writeText(phones.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No hay clientes de depilación pendientes de reactivación.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Página {currentPage} de {totalPages}
        </p>
        <button
          type="button"
          onClick={handleCopyPhones}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          {copied ? "Copiados!" : `Copiar teléfonos (${data.length})`}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Nombre", "Última visita", "Días inactivo", "Sesiones", "Teléfono", "Segmento"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {row.nombre}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                  {row.ultima_visita}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                  {row.dias_inactivo}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                  {row.total_sesiones}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                  {row.phone}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <SegmentoBadge segmento={row.segmento} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {currentPage > 1 && (
            <a
              href={`?periodo=${periodo}&page=${currentPage - 1}`}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Anterior
            </a>
          )}
          {currentPage < totalPages && (
            <a
              href={`?periodo=${periodo}&page=${currentPage + 1}`}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Siguiente
            </a>
          )}
        </div>
      )}
    </div>
  );
}
