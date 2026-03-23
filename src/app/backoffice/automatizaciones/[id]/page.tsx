import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { scheduleCampaign, cancelSchedule, deleteCampaign, cloneCampaign } from "@/actions/campaigns";

export const metadata: Metadata = { title: "Campaña" };

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",   cls: "bg-gray-100 text-gray-700" },
  scheduled: { label: "Programada", cls: "bg-blue-100 text-blue-700" },
  sending:   { label: "Enviando",   cls: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Completada", cls: "bg-green-100 text-green-700" },
  failed:    { label: "Fallida",    cls: "bg-red-100 text-red-700" },
};

interface Recipient {
  client_id: string;
  sent_at: string | null;
  error: string | null;
  clients: {
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
}

export default async function CampanaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: campaign }, { data: recipientsRaw }] = await Promise.all([
    db.from("campaigns")
      .select("id, name, body, image_url, status, scheduled_at, target_all, total_recipients, sent_count, failed_count, completed_at, created_at")
      .eq("id", id)
      .single(),
    db.from("campaign_recipients")
      .select("client_id, sent_at, error, clients(first_name, last_name, phone)")
      .eq("campaign_id", id)
      .order("sent_at", { ascending: false }),
  ]);

  if (!campaign) notFound();

  const recipients = (recipientsRaw ?? []) as Recipient[];
  const badge = STATUS_BADGE[campaign.status];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/backoffice/automatizaciones" className="text-sm text-gray-500 hover:text-gray-700">
              ← Automatizaciones
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge?.cls}`}>
              {badge?.label ?? campaign.status}
            </span>
            {campaign.scheduled_at && (
              <span className="text-sm text-gray-500">
                Programada para{" "}
                {new Date(campaign.scheduled_at).toLocaleString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {campaign.status === "draft" && (
            <>
              <Link
                href={`/backoffice/automatizaciones/${id}/editar`}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Editar
              </Link>
              {campaign.scheduled_at && (
                <form action={scheduleCampaign.bind(null, id)} className="inline">
                  <button
                    type="submit"
                    className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                  >
                    Programar envío
                  </button>
                </form>
              )}
            </>
          )}
          {campaign.status === "scheduled" && (
            <form action={cancelSchedule.bind(null, id)} className="inline">
              <button
                type="submit"
                className="rounded-md border border-yellow-300 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-50 transition-colors"
              >
                Cancelar programación
              </button>
            </form>
          )}
          <form action={cloneCampaign.bind(null, id)} className="inline">
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clonar
            </button>
          </form>
          {campaign.status === "draft" && (
            <form action={deleteCampaign.bind(null, id)} className="inline">
              <button
                type="submit"
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Eliminar
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Message preview */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Mensaje</h2>
          <div
            className="rounded-2xl p-4 shadow-sm"
            style={{ backgroundColor: "#E5DDD5" }}
          >
            <div
              className="rounded-2xl rounded-tl-none overflow-hidden max-w-[280px] ml-auto shadow"
              style={{ backgroundColor: "#DCF8C6" }}
            >
              {campaign.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={campaign.image_url}
                  alt="Campaign image"
                  className="w-full object-cover max-h-48"
                />
              )}
              <div className="px-3 py-2">
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-snug">
                  {campaign.body || <span className="italic text-gray-400">Sin texto</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Estadísticas</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-gray-500">Destinatarios</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaign.target_all ? "Todos" : campaign.total_recipients}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-gray-500">Enviados</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{campaign.sent_count}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-gray-500">Errores</p>
              <p className="mt-1 text-2xl font-bold text-red-500">{campaign.failed_count}</p>
            </div>
            {campaign.completed_at && (
              <div className="rounded-lg border bg-white p-4">
                <p className="text-xs text-gray-500">Completada</p>
                <p className="mt-1 text-sm font-medium text-gray-700">
                  {new Date(campaign.completed_at).toLocaleString("es-AR", {
                    timeZone: "America/Argentina/Buenos_Aires",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recipients list */}
      {recipients.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Destinatarios ({recipients.length})
          </h2>
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Teléfono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recipients.map((r) => (
                  <tr key={r.client_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">
                      {r.clients
                        ? `${r.clients.first_name} ${r.clients.last_name}`
                        : r.client_id}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.clients?.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.sent_at ? (
                        <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                          ✓ Enviado{" "}
                          {new Date(r.sent_at).toLocaleTimeString("es-AR", {
                            timeZone: "America/Argentina/Buenos_Aires",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : r.error ? (
                        <span className="text-xs text-red-600" title={r.error}>
                          ✗ Error
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Pendiente</span>
                      )}
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
