"use client";

import { useState, useTransition } from "react";
import { filterSegmentationClients } from "@/actions/segmentacion";
import type { SegmentationFilterCriteria, SegmentationClient } from "@/actions/segmentacion";
import SegmentacionFilterPanel, { hasAnyCriteria } from "@/components/backoffice/segmentacion-filter-panel";
import CampaignFilterPreview from "@/components/backoffice/campaign-filter-preview";
import SegmentacionBulkActions from "@/components/backoffice/segmentacion-bulk-actions";
import type { FilteredClient } from "@/actions/campaigns";
import { SEGMENTATION_PRESETS } from "@/lib/campaigns/presets";
import type { SegmentationPreset } from "@/lib/campaigns/presets";
import { Users, X } from "lucide-react";

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
    dias_desde_ultima_campana: c.dias_desde_ultima_campana,
  };
}

interface PresetBarProps {
  activePreset: string | null;
  onSelectPreset: (preset: SegmentationPreset) => void;
  onClear: () => void;
}

function PresetBar({ activePreset, onSelectPreset, onClear }: PresetBarProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Presets rápidos</p>
      <div className="flex flex-wrap gap-2">
        {SEGMENTATION_PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.descripcion}
              onClick={() => onSelectPreset(preset)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800"
              }`}
            >
              {preset.nombre}
              {isActive && (
                <span
                  role="button"
                  aria-label="Limpiar preset"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="inline-flex items-center text-primary/60 hover:text-primary"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SegmentacionClient() {
  const [criteria, setCriteria] = useState<SegmentationFilterCriteria>({});
  const [clients, setClients] = useState<SegmentationClient[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasApplied, setHasApplied] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApply(applyCriteria?: SegmentationFilterCriteria) {
    const c = applyCriteria ?? criteria;
    startTransition(async () => {
      const result = await filterSegmentationClients(c);
      setClients(result.clients);
      setTotalCount(result.count);
      setHasApplied(true);
      setSelectedIds(new Set());
    });
  }

  function handleCriteriaChange(next: SegmentationFilterCriteria) {
    setCriteria(next);
    setActivePreset(null);
  }

  function handleSelectPreset(preset: SegmentationPreset) {
    setCriteria(preset.filtros);
    setActivePreset(preset.id);
    handleApply(preset.filtros);
  }

  function handleClearPreset() {
    setCriteria({});
    setActivePreset(null);
  }

  const filteredClients = clients.map(toFilteredClient);

  return (
    <div className="space-y-4">
      <PresetBar
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
        onClear={handleClearPreset}
      />

      <SegmentacionFilterPanel
        criteria={criteria}
        onChange={handleCriteriaChange}
        onApply={() => handleApply()}
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
            Elegí un preset o configurá los filtros y presioná <strong>Aplicar filtros</strong> para ver las clientas del segmento.
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
