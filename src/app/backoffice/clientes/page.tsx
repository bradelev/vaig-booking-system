import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserPlus, GitMerge } from "lucide-react";
import ResponsiveTable, { type TableColumn } from "@/components/backoffice/responsive-table";
import PageHeader from "@/components/backoffice/page-header";
import { SEGMENTO_BADGE, SEGMENTO_OPTIONS } from "@/lib/constants/segments";

export const metadata: Metadata = { title: "Clientes" };

interface Cliente {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  total_sesiones: number;
  dias_inactivo: number | null;
  segmento: string | null;
  servicios_usados: string[] | null;
}

const ORDEN_OPTIONS = [
  { label: "Nombre A-Z", value: "nombre_asc" },
  { label: "Nombre Z-A", value: "nombre_desc" },
  { label: "Más sesiones", value: "sesiones_desc" },
  { label: "Menos sesiones", value: "sesiones_asc" },
  { label: "Visita más reciente", value: "visita_asc" },
  { label: "Visita más antigua", value: "visita_desc" },
  { label: "Segmento (mayor)", value: "segmento_desc" },
  { label: "Segmento (menor)", value: "segmento_asc" },
];

const PAGE_SIZE = 50;

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

// Categorías de servicios via regex — orden importa (primer match gana)
const CATEGORIA_REGEXES: Array<{ label: string; pattern: RegExp }> = [
  { label: "Depilación",       pattern: /depila|laser|l[aá]ser/i },
  { label: "HIFU",             pattern: /hifu|aparatolog/i },
  { label: "Masajes",          pattern: /masaje|masaj/i },
  { label: "Cejas/Pestañas",   pattern: /ceja|pesta[ñn]/i },
  { label: "Manos/Pies",       pattern: /mano|pie|manicur|pedicur/i },
];

function serviciosACategorias(servicios: string[]): string[] {
  const cats = new Set<string>();
  for (const s of servicios) {
    const match = CATEGORIA_REGEXES.find((c) => c.pattern.test(s));
    cats.add(match ? match.label : "Otros");
  }
  return Array.from(cats);
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

  const hayFiltros = !!(busqueda || segmento);

  // Total absoluto (sin filtros) — solo necesario cuando hay filtros activos
  let totalAbsoluto = 0;
  if (hayFiltros) {
    const { count: countAll } = await client
      .from("clientes_metricas")
      .select("id", { count: "exact", head: true });
    totalAbsoluto = countAll ?? 0;
  }

  let query = client
    .from("clientes_metricas")
    .select("id, first_name, last_name, phone, total_sesiones, dias_inactivo, segmento, servicios_usados", { count: "exact" });

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
    case "visita_asc": query = query.order("dias_inactivo", { ascending: true, nullsFirst: false }); break;
    case "visita_desc": query = query.order("dias_inactivo", { ascending: false, nullsFirst: false }); break;
    case "segmento_desc": query = query.order("segmento", { ascending: false, nullsFirst: false }); break;
    case "segmento_asc": query = query.order("segmento", { ascending: true, nullsFirst: false }); break;
    default: query = query.order("first_name", { ascending: true }); break;
  }

  query = query.range(from, to);

  const { data: raw, count } = await query;
  const clientes = (raw ?? []) as Cliente[];
  const total = count ?? 0;
  if (!hayFiltros) totalAbsoluto = total;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const baseParams = { busqueda: busqueda || undefined, segmento: segmento || undefined, orden: orden !== "nombre_asc" ? orden : undefined };

  function sortHref(ascValue: string, descValue: string): string {
    const next = orden === ascValue ? descValue : ascValue;
    const qs = buildSearchParams({ orden: next, pagina: undefined }, baseParams);
    return `/backoffice/clientes${qs ? `?${qs}` : ""}`;
  }

  function sortActive(ascValue: string, descValue: string): "asc" | "desc" | null {
    if (orden === ascValue) return "asc";
    if (orden === descValue) return "desc";
    return null;
  }

  const columns: TableColumn<Cliente>[] = [
    {
      header: "Nombre",
      primaryOnMobile: true,
      sortHref: sortHref("nombre_asc", "nombre_desc"),
      sortActive: sortActive("nombre_asc", "nombre_desc"),
      accessor: (c) => (
        <Link href={`/backoffice/clientes/${c.id}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors">
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
      header: "Categorías",
      hideOnMobile: true,
      accessor: (c) => {
        const cats = serviciosACategorias(c.servicios_usados ?? []);
        if (cats.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {cats.map((cat) => (
              <span
                key={cat}
                className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
              >
                {cat}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      header: "Sesiones",
      sortHref: sortHref("sesiones_asc", "sesiones_desc"),
      sortActive: sortActive("sesiones_asc", "sesiones_desc"),
      accessor: (c) => (
        <span className="whitespace-nowrap">{c.total_sesiones}</span>
      ),
    },
    {
      header: "Última visita",
      hideOnMobile: true,
      sortHref: sortHref("visita_asc", "visita_desc"),
      sortActive: sortActive("visita_asc", "visita_desc"),
      accessor: (c) => (
        <span className="whitespace-nowrap">
          {c.dias_inactivo != null ? `hace ${c.dias_inactivo} días` : "—"}
        </span>
      ),
    },
    {
      header: "Segmento",
      sortHref: sortHref("segmento_desc", "segmento_asc"),
      sortActive: sortActive("segmento_desc", "segmento_asc"),
      accessor: (c) => {
        const badge = c.segmento ? SEGMENTO_BADGE[c.segmento] : null;
        return badge ? (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
            {badge.label}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
    },
    {
      header: "Acciones",
      hideOnMobile: true,
      accessor: (c) => (
        <Link
          href={`/backoffice/clientes/${c.id}`}
          className="text-sm text-primary hover:underline"
        >
          Ver
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle={`${totalAbsoluto.toLocaleString("es-UY")} en total`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/backoffice/clientes/duplicados"
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors active:scale-[0.98]"
            >
              <GitMerge className="h-4 w-4" />
              Duplicados
            </Link>
            <Link
              href="/backoffice/clientes/nuevo"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              Nuevo cliente
            </Link>
          </div>
        }
      />

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <input
            type="text"
            name="busqueda"
            defaultValue={busqueda}
            placeholder="Nombre o teléfono..."
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-56"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Segmento</label>
          <select
            name="segmento"
            defaultValue={segmento}
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {SEGMENTO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Ordenar por</label>
          <select
            name="orden"
            defaultValue={orden}
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {ORDEN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          Filtrar
        </button>
        {(busqueda || segmento || orden !== "nombre_asc") && (
          <Link
            href="/backoffice/clientes"
            className="h-10 inline-flex items-center rounded-lg border border-input px-4 text-sm text-muted-foreground hover:bg-accent transition-colors"
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
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? (
            "Sin resultados"
          ) : (
            <>
              Mostrando {from + 1}–{Math.min(to + 1, total)} de {total.toLocaleString("es-UY")}
              {hayFiltros && ` (de ${totalAbsoluto.toLocaleString("es-UY")} total)`}
            </>
          )}
        </span>
        <div className="flex gap-2">
          {pagina > 1 && (
            <Link
              href={`?${buildSearchParams({ pagina: String(pagina - 1) }, baseParams)}`}
              className="rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              Anterior
            </Link>
          )}
          {pagina < totalPages && (
            <Link
              href={`?${buildSearchParams({ pagina: String(pagina + 1) }, baseParams)}`}
              className="rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              Siguiente
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
