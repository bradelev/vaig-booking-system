import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ResponsiveTable, { type TableColumn } from "@/components/backoffice/responsive-table";

export const metadata: Metadata = { title: "Clientes" };

interface Cliente {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  total_sesiones: number;
  dias_inactivo: number | null;
  segmento: string | null;
}

const SEGMENTO_BADGE: Record<string, { label: string; cls: string }> = {
  S5: { label: "S5 VIP",       cls: "bg-purple-100 text-purple-800" },
  S4: { label: "S4 1ra visita", cls: "bg-blue-100 text-blue-800"   },
  S3: { label: "S3 Cross-sell", cls: "bg-green-100 text-green-800" },
  S2: { label: "S2 Cuponera",   cls: "bg-yellow-100 text-yellow-800" },
  S1: { label: "S1 Dormido",    cls: "bg-red-100 text-red-800"     },
};

const SEGMENTO_OPTIONS = [
  { label: "Todos los segmentos", value: "" },
  { label: "S5 VIP", value: "S5" },
  { label: "S4 1ra visita", value: "S4" },
  { label: "S3 Cross-sell", value: "S3" },
  { label: "S2 Cuponera", value: "S2" },
  { label: "S1 Dormido", value: "S1" },
  { label: "Sin segmento", value: "none" },
];

const ORDEN_OPTIONS = [
  { label: "Nombre A-Z", value: "nombre_asc" },
  { label: "Nombre Z-A", value: "nombre_desc" },
  { label: "Más sesiones", value: "sesiones_desc" },
  { label: "Menos sesiones", value: "sesiones_asc" },
  { label: "Visita más reciente", value: "visita_asc" },
  { label: "Visita más antigua", value: "visita_desc" },
];

const PAGE_SIZE = 30;

function isPlaceholderPhone(phone: string): boolean {
  return phone.startsWith("historico_") || phone.startsWith("migrated_nophone_");
}

function buildSearchParams(
  overrides: Record<string, string | undefined>,
  base: Record<string, string | undefined>
) {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  return params.toString();
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{
    busqueda?: string;
    segmento?: string;
    orden?: string;
    pagina?: string;
  }>;
}) {
  const params = await searchParams;
  const busqueda = params.busqueda ?? "";
  const segmento = params.segmento ?? "";
  const orden = params.orden ?? "nombre_asc";
  const pagina = Math.max(1, parseInt(params.pagina ?? "1", 10));

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const from = (pagina - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = client
    .from("clientes_metricas")
    .select("id, first_name, last_name, phone, email, total_sesiones, dias_inactivo, segmento", { count: "exact" });

  if (busqueda) {
    query = query.or(`first_name.ilike.%${busqueda}%,last_name.ilike.%${busqueda}%,phone.ilike.%${busqueda}%`);
  }

  if (segmento === "none") {
    query = query.is("segmento", null);
  } else if (segmento) {
    query = query.eq("segmento", segmento);
  }

  switch (orden) {
    case "nombre_desc": query = query.order("first_name", { ascending: false }); break;
    case "sesiones_desc": query = query.order("total_sesiones", { ascending: false }); break;
    case "sesiones_asc": query = query.order("total_sesiones", { ascending: true }); break;
    case "visita_asc": query = query.order("dias_inactivo", { ascending: true }); break;
    case "visita_desc": query = query.order("dias_inactivo", { ascending: false }); break;
    default: query = query.order("first_name", { ascending: true }); break;
  }

  query = query.range(from, to);

  const { data: raw, count } = await query;
  const clientes = (raw ?? []) as Cliente[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const baseParams = { busqueda: busqueda || undefined, segmento: segmento || undefined, orden: orden !== "nombre_asc" ? orden : undefined };

  const columns: TableColumn<Cliente>[] = [
    {
      header: "Nombre",
      primaryOnMobile: true,
      accessor: (c) => (
        <Link href={`/backoffice/clientes/${c.id}`} className="text-sm font-medium text-gray-900 hover:underline">
          {c.first_name} {c.last_name}
        </Link>
      ),
    },
    {
      header: "Teléfono",
      accessor: (c) => (
        <span className="whitespace-nowrap">
          {isPlaceholderPhone(c.phone) ? "—" : c.phone}
        </span>
      ),
    },
    {
      header: "Email",
      hideOnMobile: true,
      accessor: (c) => c.email ?? "—",
    },
    {
      header: "Sesiones",
      accessor: (c) => (
        <span className="whitespace-nowrap">{c.total_sesiones}</span>
      ),
    },
    {
      header: "Última visita",
      hideOnMobile: true,
      accessor: (c) => (
        <span className="whitespace-nowrap">
          {c.dias_inactivo != null ? `hace ${c.dias_inactivo} días` : "—"}
        </span>
      ),
    },
    {
      header: "Segmento",
      accessor: (c) => {
        const badge = c.segmento ? SEGMENTO_BADGE[c.segmento] : null;
        return badge ? (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
            {badge.label}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        );
      },
    },
    {
      header: "Acciones",
      hideOnMobile: true,
      accessor: (c) => (
        <Link
          href={`/backoffice/clientes/${c.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Ver
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <Link
          href="/backoffice/clientes/nuevo"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Nuevo cliente
        </Link>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Buscar</label>
          <input
            type="text"
            name="busqueda"
            defaultValue={busqueda}
            placeholder="Nombre o teléfono..."
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Segmento</label>
          <select
            name="segmento"
            defaultValue={segmento}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {SEGMENTO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Ordenar por</label>
          <select
            name="orden"
            defaultValue={orden}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {ORDEN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Filtrar
        </button>
        {(busqueda || segmento || orden !== "nombre_asc") && (
          <Link
            href="/backoffice/clientes"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Limpiar
          </Link>
        )}
      </form>

      <ResponsiveTable
        columns={columns}
        data={clientes}
        keyExtractor={(c) => c.id}
        emptyMessage="No hay clientes que coincidan con los filtros"
      />

      {/* Paginación */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Mostrando {total === 0 ? 0 : from + 1}–{Math.min(to + 1, total)} de {total} clientes
        </span>
        <div className="flex gap-2">
          {pagina > 1 && (
            <Link
              href={`?${buildSearchParams({ pagina: String(pagina - 1) }, baseParams)}`}
              className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Anterior
            </Link>
          )}
          {pagina < totalPages && (
            <Link
              href={`?${buildSearchParams({ pagina: String(pagina + 1) }, baseParams)}`}
              className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Siguiente
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
