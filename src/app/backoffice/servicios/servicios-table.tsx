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
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
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
          <div key={category} className="rounded-lg border border-border overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCollapse(category)}
              aria-expanded={!isCollapsed}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-accent transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{category}</span>
                <span className="text-xs text-muted-foreground bg-border rounded-full px-2 py-0.5">
                  {activeCount}/{items.length}
                </span>
              </div>
              <span className="text-muted-foreground text-xs">{isCollapsed ? "▶" : "▼"}</span>
            </button>

            {!isCollapsed && (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <th className="px-4 py-2">Nombre</th>
                        <th className="px-4 py-2">Duración</th>
                        <th className="px-4 py-2">Precio</th>
                        <th className="px-4 py-2">Seña</th>
                        <th className="px-4 py-2">Profesional</th>
                        <th className="px-4 py-2">Estado</th>
                        <th className="px-4 py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((s) => {
                        const editing = editingId === s.id;
                        const toggleAction = toggleServiceActive.bind(null, s.id, s.is_active);

                        return (
                          <tr key={s.id} className={editing ? "bg-primary/5" : "bg-card hover:bg-accent/50"}>
                            <td className="px-4 py-3">
                              {editing ? (
                                <input
                                  type="text"
                                  value={editData.name}
                                  onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
                                  className="w-full rounded border border-input px-2 py-1 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                                  autoFocus
                                />
                              ) : (
                                <div>
                                  <p className="font-medium text-foreground">{s.name}</p>
                                  {s.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{s.description}</p>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-foreground">
                              {s.duration_minutes} min
                            </td>
                            <td className="px-4 py-3">
                              {editing ? (
                                <input
                                  type="number"
                                  value={editData.price}
                                  onChange={(e) => setEditData((prev) => ({ ...prev, price: e.target.value }))}
                                  className="w-28 rounded border border-input px-2 py-1 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                                  min="0"
                                  step="0.01"
                                />
                              ) : (
                                <span className="whitespace-nowrap text-foreground">{formatCurrency(s.price)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-foreground">
                              {formatCurrency(s.deposit_amount)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
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
                                    className="text-sm text-primary hover:underline"
                                  >
                                    Editar
                                  </button>
                                  <Link
                                    href={`/backoffice/servicios/${s.id}/editar`}
                                    className="text-sm text-muted-foreground hover:underline"
                                  >
                                    Ver más
                                  </Link>
                                  <form action={toggleAction}>
                                    <button
                                      type="submit"
                                      className="text-sm text-muted-foreground hover:text-foreground hover:underline"
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
                <div className="sm:hidden divide-y divide-border">
                  {items.map((s) => {
                    const editing = editingId === s.id;
                    const toggleAction = toggleServiceActive.bind(null, s.id, s.is_active);

                    return (
                      <div
                        key={s.id}
                        className={`p-3 space-y-2 ${editing ? "bg-primary/5" : "bg-card"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {editing ? (
                              <input
                                type="text"
                                value={editData.name}
                                onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full rounded border border-input px-2 py-1 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                                autoFocus
                              />
                            ) : (
                              <>
                                <p className="font-medium text-sm text-foreground truncate">{s.name}</p>
                                {s.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>
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

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{s.duration_minutes} min</span>
                          {editing ? (
                            <input
                              type="number"
                              value={editData.price}
                              onChange={(e) => setEditData((prev) => ({ ...prev, price: e.target.value }))}
                              className="w-28 rounded border border-input px-2 py-1 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
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
                              className="flex-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              onClick={() => startEdit(s)}
                              className="text-sm text-primary hover:underline"
                            >
                              Editar
                            </button>
                            <Link
                              href={`/backoffice/servicios/${s.id}/editar`}
                              className="text-sm text-muted-foreground hover:underline"
                            >
                              Ver más
                            </Link>
                            <form action={toggleAction} className="inline">
                              <button
                                type="submit"
                                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
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
