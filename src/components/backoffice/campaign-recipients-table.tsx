"use client";

import { useState, useRef, useCallback, useId } from "react";
import { toast } from "sonner";
import { searchClientsForCampaign, quickCreateClientForCampaign } from "@/actions/campaigns";

export interface RecipientClient {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
}

interface Props {
  clients: RecipientClient[];
  disabled?: boolean;
  onAdd: (client: RecipientClient) => void;
  onRemove: (clientId: string) => void;
  onUpdate: (clientId: string, patch: { first_name?: string; last_name?: string; phone?: string }) => void;
}

interface ComboboxOption {
  id: string;
  label: string;
}

function AddRowCombobox({
  onAdd,
  alreadySelectedIds,
}: {
  onAdd: (c: RecipientClient) => void;
  alreadySelectedIds: Set<string>;
}) {
  const uid = useId();
  const listboxId = `${uid}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);

  const [inputText, setInputText] = useState("");
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [rawResults, setRawResults] = useState<RecipientClient[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setOptions([]);
        setRawResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      const results = await searchClientsForCampaign(q);
      const filtered = results.filter((r) => !alreadySelectedIds.has(r.id));
      setRawResults(filtered);
      setOptions(
        filtered.map((r) => ({
          id: r.id,
          label: `${r.first_name} ${r.last_name ?? ""}`.trim() + (r.phone ? ` · ${r.phone}` : ""),
        }))
      );
      setLoading(false);
      setOpen(true);
      setActiveIndex(-1);
    },
    [alreadySelectedIds]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setInputText(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => search(q), 300);
  }

  function handleBlur() {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setOpen(false);
      }
    }, 150);
  }

  const showCreate = inputText.trim().length > 1;
  const visibleOptions: ComboboxOption[] = showCreate
    ? [...options, { id: "__create__", label: `Crear "${inputText.trim()}"` }]
    : options;

  async function selectOption(opt: ComboboxOption) {
    if (opt.id === "__create__") {
      const query = inputText.trim();
      const parts = query.split(/\s+/);
      const first_name = parts[0] ?? query;
      const last_name = parts.slice(1).join(" ") || undefined;
      try {
        const created = await quickCreateClientForCampaign({ first_name, last_name, phone: query });
        onAdd(created);
        setInputText("");
        setOpen(false);
        setOptions([]);
        setRawResults([]);
      } catch {
        toast.error("No se pudo crear el cliente");
      }
    } else {
      const raw = rawResults.find((r) => r.id === opt.id);
      if (raw) {
        onAdd(raw);
        setInputText("");
        setOpen(false);
        setOptions([]);
        setRawResults([]);
      }
    }
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((p) => Math.min(p + 1, visibleOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && visibleOptions[activeIndex]) selectOption(visibleOptions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${uid}-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        aria-label="Agregar destinatario"
        value={inputText}
        placeholder="Buscar o escribir nombre/teléfono..."
        className="w-full rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white focus:border-solid"
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {loading && <div className="absolute right-3 top-2 text-xs text-gray-400">Buscando...</div>}
      {open && visibleOptions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {visibleOptions.map((opt, idx) => (
            <li
              key={opt.id}
              id={`${uid}-option-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
              className={`cursor-pointer px-3 py-2 text-sm ${
                idx === activeIndex
                  ? "bg-gray-100 text-gray-900"
                  : opt.id === "__create__"
                  ? "text-blue-600 hover:bg-blue-50"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CampaignRecipientsTable({ clients, disabled, onAdd, onRemove, onUpdate }: Props) {
  const selectedIds = new Set(clients.map((c) => c.id));

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[30%]">Nombre</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[30%]">Apellido</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[30%]">Teléfono</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {clients.map((c) => (
            <RecipientRow
              key={c.id}
              client={c}
              disabled={!!disabled}
              onRemove={onRemove}
              onUpdate={onUpdate}
            />
          ))}
          {!disabled && (
            <tr>
              <td colSpan={4} className="px-2 py-1.5">
                <AddRowCombobox onAdd={onAdd} alreadySelectedIds={selectedIds} />
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="bg-gray-50 border-t border-gray-200">
          <tr>
            <td colSpan={4} className="px-3 py-2 text-xs text-gray-500">
              {clients.length} destinatario{clients.length !== 1 ? "s" : ""}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RecipientRow({
  client,
  disabled,
  onRemove,
  onUpdate,
}: {
  client: RecipientClient;
  disabled: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: { first_name?: string; last_name?: string; phone?: string }) => void;
}) {
  const [firstName, setFirstName] = useState(client.first_name);
  const [lastName, setLastName] = useState(client.last_name ?? "");
  const [phone, setPhone] = useState(client.phone);

  async function handleBlur(field: "first_name" | "last_name" | "phone", value: string) {
    const original =
      field === "first_name" ? client.first_name : field === "last_name" ? (client.last_name ?? "") : client.phone;
    if (value === original) return;
    try {
      await onUpdate(client.id, { [field]: value });
      toast.success("Cliente actualizado");
    } catch {
      toast.error("No se pudo guardar el cambio");
      if (field === "first_name") setFirstName(client.first_name);
      else if (field === "last_name") setLastName(client.last_name ?? "");
      else setPhone(client.phone);
    }
  }

  const cellClass =
    "w-full bg-transparent px-1 py-0.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400 rounded disabled:text-gray-500";

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-2 py-1">
        <input
          type="text"
          value={firstName}
          disabled={disabled}
          className={cellClass}
          onChange={(e) => setFirstName(e.target.value)}
          onBlur={(e) => handleBlur("first_name", e.target.value)}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          value={lastName}
          disabled={disabled}
          className={cellClass}
          onChange={(e) => setLastName(e.target.value)}
          onBlur={(e) => handleBlur("last_name", e.target.value)}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          value={phone}
          disabled={disabled}
          className={cellClass}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={(e) => handleBlur("phone", e.target.value)}
        />
      </td>
      <td className="px-2 py-1 text-center">
        {!disabled && (
          <button
            type="button"
            onClick={() => onRemove(client.id)}
            aria-label={`Quitar ${client.first_name}`}
            className="text-gray-400 hover:text-red-500 transition-colors text-base leading-none"
          >
            ×
          </button>
        )}
      </td>
    </tr>
  );
}
