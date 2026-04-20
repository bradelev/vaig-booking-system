"use client";

import { useState, useTransition } from "react";
import { filterSegmentationClients } from "@/actions/segmentacion";
import type { SegmentationFilterCriteria, SegmentationClient } from "@/actions/segmentacion";
import SegmentacionFilterPanel, { hasAnyCriteria } from "@/components/backoffice/segmentacion-filter-panel";
import CampaignFilterPreview from "@/components/backoffice/campaign-filter-preview";
import SegmentacionBulkActions from "@/components/backoffice/segmentacion-bulk-actions";
import type { FilteredClient } from "@/actions/campaigns";
import { Users } from "lucide-react";

function toFilteredClient(c: SegmentationClient): FilteredClient {
  return {
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone,
    segmento: c.segmento,
    categoria: c.categoria,
    total_sesiones: c.total_sesiones,
    dias_inactivo: c.dias_inactivo,
  };
}

export default function SegmentacionClient() {
  const [criteria, setCriteria] = useState<SegmentationFilterCriteria>({});
  const [clients, setClients] = useState<SegmentationClient[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasApplied, setHasApplied] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    startTransition(async () => {
      const result = await filterSegmentationClients(criteria);
      setClients(result.clients);
      setTotalCount(result.count);
      setHasApplied(true);
      setSelectedIds(new Set());
    });
  }

  const filteredClients = clients.map(toFilteredClient);

  return (
    <div className="space-y-6">
      <SegmentacionFilterPanel
        criteria={criteria}
        onChange={setCriteria}
        onApply={handleApply}
        isPending={isPending}
      />

      <SegmentacionBulkActions
        selectedIds={selectedIds}
        clients={clients}
        criteria={criteria}
      />

      {!hasApplied && !isPending && (
        <div className="rounded-lg border border-gray-200 p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            Configurá los filtros y presioná <strong>Aplicar filtros</strong> para ver las clientas del segmento.
          </p>
          {!hasAnyCriteria(criteria) && (
            <p className="text-xs text-gray-400 mt-1">
              Se excluyen automáticamente las clientas con turno en los próximos 14 días.
            </p>
          )}
        </div>
      )}

      {(hasApplied || isPending) && (
        <CampaignFilterPreview
          clients={filteredClients}
          totalCount={totalCount}
          loading={isPending}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}
    </div>
  );
}
