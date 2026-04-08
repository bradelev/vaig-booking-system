"use client";

import { SEGMENTO_FILTER_OPTIONS, SEGMENTO_BADGE, CATEGORIA_OPTIONS } from "@/lib/constants/segments";
import { SERVICE_CATEGORIES } from "@/lib/constants/service-categories";
import type { CampaignFilterCriteria } from "@/actions/campaigns";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CampaignFilterPanelProps {
  criteria: CampaignFilterCriteria;
  onChange: (criteria: CampaignFilterCriteria) => void;
  onApply: () => void;
  isPending: boolean;
  disabled?: boolean;
}

function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
  badgeMap,
  disabled,
}: {
  label: string;
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  badgeMap?: Record<string, { label: string; cls: string }>;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          const badge = badgeMap?.[opt.value];
          return (
            <label
              key={opt.value}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${
                checked
                  ? badge?.cls ?? "border-primary/30 bg-primary/10 text-primary"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  onChange(
                    checked
                      ? selected.filter((v) => v !== opt.value)
                      : [...selected, opt.value]
                  );
                }}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function RangeInput({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
  placeholderMin = "Min",
  placeholderMax = "Max",
  disabled,
}: {
  label: string;
  min: number | null | undefined;
  max: number | null | undefined;
  onMinChange: (v: number | null) => void;
  onMaxChange: (v: number | null) => void;
  placeholderMin?: string;
  placeholderMax?: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-700">{label}</legend>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          placeholder={placeholderMin}
          value={min ?? ""}
          onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : null)}
          className="w-24 h-8 text-sm"
          disabled={disabled}
        />
        <span className="text-gray-400 text-sm">a</span>
        <Input
          type="number"
          min={0}
          placeholder={placeholderMax}
          value={max ?? ""}
          onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : null)}
          className="w-24 h-8 text-sm"
          disabled={disabled}
        />
      </div>
    </fieldset>
  );
}

const hasAnyCriteria = (c: CampaignFilterCriteria) =>
  (c.segmentos?.length ?? 0) > 0 ||
  (c.categorias?.length ?? 0) > 0 ||
  (c.serviceCategories?.length ?? 0) > 0 ||
  c.totalSesionesMin != null ||
  c.totalSesionesMax != null ||
  c.diasInactivoMin != null ||
  c.diasInactivoMax != null ||
  c.consentOnly === true;

export { hasAnyCriteria };

export default function CampaignFilterPanel({
  criteria,
  onChange,
  onApply,
  isPending,
  disabled,
}: CampaignFilterPanelProps) {
  const update = (patch: Partial<CampaignFilterCriteria>) =>
    onChange({ ...criteria, ...patch });

  const clear = () =>
    onChange({});

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <CheckboxGroup
          label="Segmento"
          options={SEGMENTO_FILTER_OPTIONS}
          selected={criteria.segmentos ?? []}
          onChange={(v) => update({ segmentos: v })}
          badgeMap={SEGMENTO_BADGE}
          disabled={disabled}
        />

        <CheckboxGroup
          label="Categoría de actividad"
          options={CATEGORIA_OPTIONS}
          selected={criteria.categorias ?? []}
          onChange={(v) => update({ categorias: v })}
          disabled={disabled}
        />

        <div className="sm:col-span-2">
          <CheckboxGroup
            label="Categoría de servicio"
            options={SERVICE_CATEGORIES.map((c) => ({ label: c, value: c }))}
            selected={criteria.serviceCategories ?? []}
            onChange={(v) => update({ serviceCategories: v })}
            disabled={disabled}
          />
        </div>

        <RangeInput
          label="Total de sesiones"
          min={criteria.totalSesionesMin}
          max={criteria.totalSesionesMax}
          onMinChange={(v) => update({ totalSesionesMin: v })}
          onMaxChange={(v) => update({ totalSesionesMax: v })}
          placeholderMin="0"
          placeholderMax="∞"
          disabled={disabled}
        />

        <RangeInput
          label="Días de inactividad"
          min={criteria.diasInactivoMin}
          max={criteria.diasInactivoMax}
          onMinChange={(v) => update({ diasInactivoMin: v })}
          onMaxChange={(v) => update({ diasInactivoMax: v })}
          placeholderMin="0"
          placeholderMax="365"
          disabled={disabled}
        />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={criteria.consentOnly ?? false}
            onChange={(e) => update({ consentOnly: e.target.checked || undefined })}
            disabled={disabled}
          />
          Solo clientes con consentimiento RNPD
        </label>
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 pt-3">
        <Button
          type="button"
          onClick={onApply}
          disabled={disabled || isPending || !hasAnyCriteria(criteria)}
          size="sm"
        >
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? "Filtrando..." : "Aplicar filtros"}
        </Button>
        {hasAnyCriteria(criteria) && (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
