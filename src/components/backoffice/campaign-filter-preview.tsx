"use client";

import type { FilteredClient } from "@/actions/campaigns";
import { SEGMENTO_BADGE } from "@/lib/constants/segments";
import { AlertTriangle, Users } from "lucide-react";

interface CampaignFilterPreviewProps {
  clients: FilteredClient[];
  totalCount: number;
  loading: boolean;
}

export default function CampaignFilterPreview({
  clients,
  totalCount,
  loading,
}: CampaignFilterPreviewProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500 animate-pulse">
        Buscando clientes...
      </div>
    );
  }

  const noConsentCount = clients.filter((c) => !c.consent_accepted_at).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
          <Users className="h-3.5 w-3.5" />
          {totalCount} cliente{totalCount !== 1 ? "s" : ""} coinciden
        </div>
        {totalCount > 500 && (
          <span className="text-xs text-amber-600 font-medium">La campaña se enviará a los primeros 500 clientes</span>
        )}
        {noConsentCount > 0 && (
          <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            {noConsentCount} sin RNPD
          </div>
        )}
      </div>

      {totalCount === 0 ? (
        <div className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500">
          Ningún cliente coincide con los filtros seleccionados.
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Nombre</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 hidden sm:table-cell">Teléfono</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Segmento</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 hidden md:table-cell">Categoría</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Sesiones</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 hidden md:table-cell">Días inact.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => {
                const badge = c.segmento ? SEGMENTO_BADGE[c.segmento] : null;
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-1.5">
                      <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                      {!c.consent_accepted_at && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          RNPD
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500 hidden sm:table-cell">{c.phone}</td>
                    <td className="px-3 py-1.5">
                      {badge ? (
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600 capitalize hidden md:table-cell">
                      {c.categoria?.replace("_", " ") ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{c.total_sesiones}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 hidden md:table-cell">
                      {c.dias_inactivo ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
