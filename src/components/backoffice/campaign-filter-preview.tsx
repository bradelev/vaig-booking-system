"use client";

import { useState, useTransition } from "react";
import type { FilteredClient } from "@/actions/campaigns";
import { updateClientPhone } from "@/actions/campaigns";
import { SEGMENTO_BADGE } from "@/lib/constants/segments";
import { AlertTriangle, Users, Check, X, Pencil } from "lucide-react";

interface CampaignFilterPreviewProps {
  clients: FilteredClient[];
  totalCount: number;
  loading: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  disabled?: boolean;
}

function InlinePhoneEdit({
  clientId,
  initialPhone,
  onSaved,
}: {
  clientId: string;
  initialPhone: string;
  onSaved: (phone: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialPhone);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <span className="group inline-flex items-center gap-1">
        <span>{initialPhone}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
          aria-label="Editar teléfono"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </span>
    );
  }

  function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await updateClientPhone(clientId, trimmed);
      onSaved(trimmed);
      setEditing(false);
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setValue(initialPhone);
            setEditing(false);
          }
        }}
        disabled={isPending}
        autoFocus
        className="w-32 rounded border border-gray-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="text-green-600 hover:text-green-700 disabled:opacity-50"
        aria-label="Guardar"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(initialPhone);
          setEditing(false);
        }}
        disabled={isPending}
        className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
        aria-label="Cancelar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export default function CampaignFilterPreview({
  clients,
  totalCount,
  loading,
  selectedIds,
  onSelectionChange,
  disabled,
}: CampaignFilterPreviewProps) {
  const [phoneOverrides, setPhoneOverrides] = useState<Record<string, string>>({});

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500 animate-pulse">
        Buscando clientes...
      </div>
    );
  }

  const noConsentCount = clients.filter((c) => !c.consent_accepted_at).length;
  const allSelected = clients.length > 0 && clients.every((c) => selectedIds.has(c.id));
  const someSelected = clients.some((c) => selectedIds.has(c.id));

  function toggleAll() {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(clients.map((c) => c.id)));
    }
  }

  function toggleClient(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
          <Users className="h-3.5 w-3.5" />
          {totalCount} cliente{totalCount !== 1 ? "s" : ""} coinciden
        </div>
        {selectedIds.size > 0 && selectedIds.size !== clients.length && (
          <span className="text-sm text-gray-500">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
        )}
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
        <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleAll}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Nombre</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Teléfono</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Segmento</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 hidden md:table-cell">Categoría</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Sesiones</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 hidden md:table-cell">Días inact.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => {
                const badge = c.segmento ? SEGMENTO_BADGE[c.segmento] : null;
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-gray-50/50 ${!isSelected ? "opacity-50" : ""}`}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleClient(c.id)}
                        disabled={disabled}
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        aria-label={`Seleccionar ${c.first_name} ${c.last_name}`}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                      {!c.consent_accepted_at && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          RNPD
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">
                      <InlinePhoneEdit
                        clientId={c.id}
                        initialPhone={phoneOverrides[c.id] ?? c.phone}
                        onSaved={(phone) =>
                          setPhoneOverrides((prev) => ({ ...prev, [c.id]: phone }))
                        }
                      />
                    </td>
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
