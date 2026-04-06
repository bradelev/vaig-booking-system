"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { updateServiceInline, toggleServiceActive } from "@/actions/servicios";

interface Servicio {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  deposit_amount: number;
  is_active: boolean;
  professionals: { name: string } | null;
}

interface EditData {
  name: string;
  price: string;
}

interface ServiciosTableProps {
  servicios: Servicio[];
}

// Category inference — order matters (first match wins)
const CATEGORY_RULES: { label: string; match: (name: string) => boolean }[] = [
  { label: "Depilación láser", match: (n) => n.toLowerCase().startsWith("depilación láser") },
  { label: "Hifu", match: (n) => n.toLowerCase().startsWith("hifu") },
  { label: "Masajes", match: (n) => /masaje|descontracturante|piedras calientes/i.test(n) },
  { label: "Drenaje y corporal", match: (n) => /drenaje|maderoterapia|reductores|exfoliación|nutrición corporal|electrodos|ultracavitador|ultrasonido|plasmapen/i.test(n) },
  { label: "Day Spa", match: (n) => n.toLowerCase().startsWith("day spa") },
  { label: "Cejas y pestañas", match: (n) => /cejas|pestañas|laminado|lifting de pestañas/i.test(n) },
  { label: "Facial", match: (n) => /facial|hidratación|dermaplaning|antiacné|limpieza facial/i.test(n) },
  { label: "Uñas", match: (n) => /esculpidas|esmaltado|kapping|manos y pies|estética de pies|semi permanente|retirado/i.test(n) },
  { label: "Combos", match: (n) => n.toLowerCase().startsWith("combo") },
];

function inferCategory(name: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.match(name)) return rule.label;
  }
  return "Otros";
}

function groupByCategory(servicios: Servicio[]): Map<string, Servicio[]> {
  const map = new Map<string, Servicio[]>();
  // Maintain category order
  const order = [...CATEGORY_RULES.map((r) => r.label), "Otros"];

  for (const s of servicios) {
    const cat = inferCategory(s.name);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(s);
  }

  // Sort map by predefined order
  const sorted = new Map<string, Servicio[]>();
  for (const cat of order) {
    if (map.has(cat)) sorted.set(cat, map.get(cat)!);
  }
  return sorted;
}

export default function ServiciosTable({ servicios }: ServiciosTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData>({ name: "", price: "" });
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditData({ name: "", price: "" });
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && editingId) cancelEdit();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingId, cancelEdit]);

  function startEdit(s: Servicio) {
    setEditingId(s.id);
    setEditData({ name: s.name, price: String(s.price) });
  }

  async function saveEdit(id: string) {
    const name = editData.name.trim();
    const price = Number(editData.price);

    if (!name) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("El precio debe ser un número positivo");
      return;
    }

    setSaving(true);
    try {
      const result = await updateServiceInline(id, { name, price });
      if (result.success) {
        toast.success("Servicio actualizado");
        cancelEdit();
      } else {
        toast.error(result.error ?? "Error al actualizar");
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleCollapse(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (servicios.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
        No hay servicios creados aún
      </div>
    );
  }

  const groups = groupByCategory(servicios);

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([category, items]) => {
        const isCollapsed = collapsed.has(category);
        const activeCount = items.filter((s) => s.is_active).length;

        return (
          <div key={category} className="rounded-lg border border-gray-200 overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCollapse(category)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-800">{category}</span>
                <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                  {activeCount}/{items.length}
                </span>
              </div>
              <span className="text-gray-400 text-xs">{isCollapsed ? "▶" : "▼"}</span>
            </button>

            {!isCollapsed && (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-2">Nombre</th>
                        <th className="px-4 py-2">Duración</th>
                        <th className="px-4 py-2">Precio</th>
                        <th className="px-4 py-2">Seña</th>
                        <th className="px-4 py-2">Profesional</th>
                        <th className="px-4 py-2">Estado</th>
                        <th className="px-4 py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((s) => {
                        const editing = editingId === s.id;
                        const toggleAction = toggleServiceActive.bind(null, s.id, s.is_active);

                        return (
                          <tr key={s.id} className={editing ? "bg-blue-50" : "bg-white hover:bg-gray-50"}>
                            <td className="px-4 py-3">
                              {editing ? (
                                <input
                                  type="text"
                                  value={editData.name}
                                  onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  autoFocus
                                />
                              ) : (
                                <div>
                                  <p className="font-medium text-gray-900">{s.name}</p>
                                  {s.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{s.description}</p>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {s.duration_minutes} min
                            </td>
                            <td className="px-4 py-3">
                              {editing ? (
                                <input
                                  type="number"
                                  value={editData.price}
                                  onChange={(e) => setEditData((prev) => ({ ...prev, price: e.target.value }))}
                                  className="w-28 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  min="0"
                                  step="0.01"
                                />
                              ) : (
                                <span className="whitespace-nowrap text-gray-700">{formatCurrency(s.price)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {formatCurrency(s.deposit_amount)}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {s.professionals?.name ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  s.is_active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {s.is_active ? "Activo" : "Inactivo"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {editing ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => saveEdit(s.id)}
                                    disabled={saving}
                                    title="Guardar"
                                    className="rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    title="Cancelar"
                                    className="rounded-lg bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => startEdit(s)}
                                    className="text-sm text-blue-600 hover:underline"
                                  >
                                    Editar
                                  </button>
                                  <Link
                                    href={`/backoffice/servicios/${s.id}/editar`}
                                    className="text-sm text-gray-500 hover:underline"
                                  >
                                    Ver más
                                  </Link>
                                  <form action={toggleAction}>
                                    <button
                                      type="submit"
                                      className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
                                    >
                                      {s.is_active ? "Desactivar" : "Activar"}
                                    </button>
                                  </form>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {items.map((s) => {
                    const editing = editingId === s.id;
                    const toggleAction = toggleServiceActive.bind(null, s.id, s.is_active);

                    return (
                      <div
                        key={s.id}
                        className={`p-3 space-y-2 ${editing ? "bg-blue-50" : "bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {editing ? (
                              <input
                                type="text"
                                value={editData.name}
                                onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                            ) : (
                              <>
                                <p className="font-medium text-sm text-gray-900 truncate">{s.name}</p>
                                {s.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">{s.description}</p>
                                )}
                              </>
                            )}
                          </div>
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              s.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {s.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <span>{s.duration_minutes} min</span>
                          {editing ? (
                            <input
                              type="number"
                              value={editData.price}
                              onChange={(e) => setEditData((prev) => ({ ...prev, price: e.target.value }))}
                              className="w-28 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              min="0"
                              step="0.01"
                              placeholder="Precio"
                            />
                          ) : (
                            <span>{formatCurrency(s.price)}</span>
                          )}
                          {s.professionals?.name && <span>{s.professionals.name}</span>}
                        </div>

                        {editing ? (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => saveEdit(s.id)}
                              disabled={saving}
                              className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              onClick={() => startEdit(s)}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              Editar
                            </button>
                            <Link
                              href={`/backoffice/servicios/${s.id}/editar`}
                              className="text-sm text-gray-500 hover:underline"
                            >
                              Ver más
                            </Link>
                            <form action={toggleAction} className="inline">
                              <button
                                type="submit"
                                className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
                              >
                                {s.is_active ? "Desactivar" : "Activar"}
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
