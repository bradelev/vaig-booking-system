"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface ComboboxItem {
  id: string;
  label: string;
}

interface ComboboxProps {
  items: ComboboxItem[];
  value: string;
  onChange: (id: string, label: string) => void;
  onCreateNew?: (query: string) => void;
  placeholder?: string;
}

export default function Combobox({
  items,
  value,
  onChange,
  onCreateNew,
  placeholder = "Buscar...",
}: ComboboxProps) {
  const [inputText, setInputText] = useState(() => {
    const item = items.find((i) => i.id === value);
    return item?.label ?? "";
  });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // When a value is selected, show the label; otherwise show what the user typed for filtering
  const selectedLabel = value ? (items.find((i) => i.id === value)?.label ?? "") : "";
  const filterQuery = value ? "" : inputText;

  const filtered = filterQuery
    ? items.filter((i) => i.label.toLowerCase().includes(filterQuery.toLowerCase()))
    : items;

  const hasExactMatch = filtered.some(
    (i) => i.label.toLowerCase() === filterQuery.toLowerCase()
  );
  const showCreate = onCreateNew && filterQuery.trim().length > 0 && !hasExactMatch;
  const options: ComboboxItem[] = showCreate
    ? [...filtered, { id: "__create__", label: `Crear: ${filterQuery.trim()}` }]
    : filtered;
  const visibleOptions = options.slice(0, 8);

  const selectItem = useCallback(
    (item: ComboboxItem) => {
      if (item.id === "__create__") {
        onCreateNew?.(filterQuery.trim());
        setOpen(false);
      } else {
        onChange(item.id, item.label);
        setInputText(item.label);
        setOpen(false);
      }
      setActiveIndex(-1);
    },
    [onChange, onCreateNew, filterQuery]
  );

  function restoreInput() {
    setInputText(selectedLabel || "");
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, visibleOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && visibleOptions[activeIndex]) {
        selectItem(visibleOptions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      restoreInput();
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        restoreInput();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabel]);

  const displayValue = value ? selectedLabel : inputText;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={displayValue}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        onChange={(e) => {
          setInputText(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
          if (value) onChange("", "");
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && visibleOptions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {visibleOptions.map((item, idx) => (
            <li
              key={item.id}
              className={`cursor-pointer px-3 py-2 text-sm ${
                idx === activeIndex
                  ? "bg-gray-100 text-gray-900"
                  : item.id === "__create__"
                  ? "text-blue-600 hover:bg-blue-50"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(item);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
