import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/backoffice/stat-card";
import AddContactoForm from "@/components/backoffice/add-contacto-form";
import { formatCurrency, formatDate, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from "@/lib/utils";

interface ClienteMetrica {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  source: string | null;
  instagram: string | null;
  notas: string | null;
  categoria: string | null;
  total_sesiones: number | null;
  total_cobrado: number | null;
  ticket_promedio: number | null;
  dias_inactivo: number | null;
  tiene_cross_sell: boolean | null;
  requiere_reactivacion: boolean | null;
}

interface Booking {
  id: string;
  scheduled_at: string;
  status: string;
  amount: number | null;
  service: { name: string } | null;
  professional: { name: string } | null;
}

interface SesionHistorica {
  id: string;
  fecha: string;
  servicio: string | null;
  profesional: string | null;
  monto: number | null;
  estado: string | null;
  fuente: string | null;
}

interface Contacto {
  id: string;
  fecha: string;
  canal: string;
  motivo: string | null;
  resultado: string | null;
  notas: string | null;
}

interface Membresia {
  id: string;
  plan_nombre: string | null;
  servicios_incluidos: number | null;
  precio: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string | null;
}

interface TimelineEntry {
  id: string;
  fecha: string;
  servicio: string | null;
  profesional: string | null;
  monto: number | null;
  estado: string | null;
  fuente: "sistema" | "historico";
}

const CATEGORIA_COLORS: Record<string, string> = {
  activa: "bg-green-100 text-green-800",
  en_riesgo: "bg-yellow-100 text-yellow-800",
  inactiva: "bg-gray-100 text-gray-800",
  perdida: "bg-red-100 text-red-800",
  sin_visitas: "bg-blue-100 text-blue-800",
};

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [
    { data: metricaRaw },
    { data: bookingsRaw },
    { data: sesionesRaw },
    { data: contactosRaw },
    { data: membresiasRaw },
  ] = await Promise.all([
    db.from("clientes_metricas").select("*").eq("id", id).single(),
    db
      .from("bookings")
      .select("id, scheduled_at, status, amount, service:services(name), professional:professionals(name)")
      .eq("client_id", id)
      .order("scheduled_at", { ascending: false }),
    db
      .from("sesiones_historicas")
      .select("id, fecha, servicio, profesional, monto, estado, fuente")
      .eq("client_id", id)
      .order("fecha", { ascending: false }),
    db
      .from("contactos")
      .select("id, fecha, canal, motivo, resultado, notas")
      .eq("client_id", id)
      .order("fecha", { ascending: false }),
    db
      .from("membresias")
      .select("id, plan_nombre, servicios_incluidos, precio, fecha_inicio, fecha_fin, estado")
      .eq("client_id", id)
      .order("fecha_inicio", { ascending: false }),
  ]);

  const metrica = metricaRaw as ClienteMetrica | null;
  if (!metrica) notFound();

  const bookings = (bookingsRaw ?? []) as Booking[];
  const sesiones = (sesionesRaw ?? []) as SesionHistorica[];
  const contactos = (contactosRaw ?? []) as Contacto[];
  const membresias = (membresiasRaw ?? []) as Membresia[];

  // Build unified timeline
  const timelineFromBookings: TimelineEntry[] = bookings.map((b) => ({
    id: b.id,
    fecha: b.scheduled_at,
    servicio: b.service?.name ?? null,
    profesional: b.professional?.name ?? null,
    monto: b.amount,
    estado: b.status,
    fuente: "sistema",
  }));

  const timelineFromHistorico: TimelineEntry[] = sesiones.map((s) => ({
    id: s.id,
    fecha: s.fecha,
    servicio: s.servicio,
    profesional: s.profesional,
    monto: s.monto,
    estado: s.estado,
    fuente: "historico",
  }));

  const timeline: TimelineEntry[] = [...timelineFromBookings, ...timelineFromHistorico].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  const nombre = `${metrica.first_name} ${metrica.last_name}`;
  const categoriaColor = CATEGORIA_COLORS[metrica.categoria ?? ""] ?? "bg-gray-100 text-gray-800";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/backoffice/clientes" className="text-sm text-gray-500 hover:text-gray-800">
              ← Clientes
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{nombre}</h1>
            {metrica.categoria && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${categoriaColor}`}>
                {metrica.categoria.replace("_", " ")}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span>{metrica.phone}</span>
            {metrica.email && <span>{metrica.email}</span>}
            {metrica.instagram && <span>@{metrica.instagram}</span>}
            {metrica.source && <span className="capitalize">{metrica.source}</span>}
          </div>
          <div className="mt-2 flex gap-2">
            {metrica.tiene_cross_sell && (
              <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                Cross-sell
              </span>
            )}
            {metrica.requiere_reactivacion && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                Reactivar
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/backoffice/clientes/${id}/editar`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Editar
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Sesiones" value={metrica.total_sesiones ?? 0} />
        <StatCard
          title="Total cobrado"
          value={metrica.total_cobrado ? formatCurrency(metrica.total_cobrado) : "$0"}
        />
        <StatCard
          title="Ticket promedio"
          value={metrica.ticket_promedio ? formatCurrency(metrica.ticket_promedio) : "—"}
        />
        <StatCard
          title="Días inactivo"
          value={metrica.dias_inactivo ?? 0}
        />
      </div>

      {/* Timeline */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Historial de sesiones</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Fecha", "Servicio", "Profesional", "Monto", "Estado", "Fuente"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {timeline.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    Sin sesiones registradas
                  </td>
                </tr>
              ) : (
                timeline.map((entry) => {
                  const statusColor = entry.fuente === "sistema"
                    ? (BOOKING_STATUS_COLORS[entry.estado ?? ""] ?? "bg-gray-100 text-gray-800")
                    : "bg-gray-100 text-gray-600";
                  const statusLabel = entry.fuente === "sistema"
                    ? (BOOKING_STATUS_LABELS[entry.estado ?? ""] ?? entry.estado ?? "—")
                    : (entry.estado ?? "—");
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                        {formatDate(entry.fecha)}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">{entry.servicio ?? "—"}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">{entry.profesional ?? "—"}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                        {entry.monto ? formatCurrency(entry.monto) : "—"}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            entry.fuente === "sistema"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {entry.fuente === "sistema" ? "Sistema" : "Histórico"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contactos */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Contactos</h2>
          <AddContactoForm clientId={id} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Fecha", "Canal", "Motivo", "Resultado", "Notas"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {contactos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    Sin contactos registrados
                  </td>
                </tr>
              ) : (
                contactos.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                      {formatDate(c.fecha)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700 capitalize">{c.canal}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{c.motivo ?? "—"}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{c.resultado ?? "—"}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{c.notas ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Membresías */}
      {membresias.length > 0 && (
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Membresías</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Plan", "Servicios", "Precio", "Inicio", "Fin", "Estado"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {membresias.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{m.plan_nombre ?? "—"}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{m.servicios_incluidos ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                      {m.precio ? formatCurrency(m.precio) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                      {m.fecha_inicio ? formatDate(m.fecha_inicio) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                      {m.fecha_fin ? formatDate(m.fecha_fin) : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                        {m.estado ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
