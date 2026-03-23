"use client";

import { useState, useRef, useCallback, useId } from "react";
import { searchClients } from "@/actions/sesiones";

export interface ClientOption {
  id: string;
  label: string;
}

interface ClientSearchComboboxProps {
  value: string;
  selectedLabel: string;
  onChange: (id: string, label: string) => void;
  onCreateNew?: (query: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}

export default function ClientSearchCombobox({
  value,
  selectedLabel,
  onChange,
  onCreateNew,
  placeholder = "Buscar cliente...",
  "aria-label": ariaLabel,
}: ClientSearchComboboxProps) {
  const uid = useId();
  const listboxId = `${uid}-listbox`;

  const [inputText, setInputText] = useState(selectedLabel);
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setOptions([]); setOpen(false); return; }
    setLoading(true);
    const results = await searchClients(q);
    const items: ClientOption[] = results.map((r) => ({
      id: r.id,
      label: `${r.first_name} ${r.last_name}${r.phone ? ` · ${r.phone}` : ""}`,
    }));
    setOptions(items);
    setLoading(false);
    setOpen(true);
    setActiveIndex(-1);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setInputText(q);
    if (value) onChange("", ""); // clear selection
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => search(q), 300);
  }

  function handleFocus() {
    if (options.length > 0) setOpen(true);
  }

  function handleBlur() {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setOpen(false);
        if (!value) setInputText("");
      }
    }, 150);
  }

  function selectOption(opt: ClientOption) {
    if (opt.id === "__create__") {
      onCreateNew?.(inputText.trim());
      setOpen(false);
    } else {
      onChange(opt.id, opt.label);
      setInputText(opt.label);
      setOpen(false);
      setOptions([]);
    }
    setActiveIndex(-1);
  }

  const showCreate = onCreateNew && inputText.trim().length > 1 && !value;
  const visibleOptions: ClientOption[] = showCreate
    ? [...options, { id: "__create__", label: `Crear: ${inputText.trim()}` }]
    : options;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown") { setOpen(true); setActiveIndex(0); e.preventDefault(); }
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
      if (!value) setInputText("");
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
        aria-label={ariaLabel}
        value={inputText}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</div>
      )}
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
              onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
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
