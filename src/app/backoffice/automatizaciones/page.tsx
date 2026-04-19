import type { Metadata } from "next";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ResponsiveTable, { type TableColumn } from "@/components/backoffice/responsive-table";
import { ConfirmDeleteForm } from "@/components/backoffice/confirm-delete-form";
import { deleteCampaign, cloneCampaign, cancelSchedule } from "@/actions/campaigns";

export const metadata: Metadata = { title: "Campañas" };

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",    cls: "bg-muted text-muted-foreground" },
  scheduled: { label: "Programada",  cls: "bg-primary/10 text-primary" },
  sending:   { label: "Enviando",    cls: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Completada",  cls: "bg-green-100 text-green-700" },
  failed:    { label: "Fallida",     cls: "bg-red-100 text-red-700" },
};

interface Campaign {
  id: string;
  name: string;
  status: string;
  scheduled_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

export default async function AutomatizacionesPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: raw } = await db
    .from("campaigns")
    .select("id, name, status, scheduled_at, total_recipients, sent_count, failed_count, created_at")
    .order("created_at", { ascending: false });

  const campaigns = (raw ?? []) as Campaign[];

  const columns: TableColumn<Campaign>[] = [
    {
      header: "Nombre",
      primaryOnMobile: true,
      accessor: (c) => (
        <Link
          href={`/backoffice/automatizaciones/${c.id}`}
          className="text-sm font-medium text-foreground hover:underline"
        >
          {c.name}
        </Link>
      ),
    },
    {
      header: "Estado",
      accessor: (c) => {
        const badge = STATUS_BADGE[c.status];
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge?.cls ?? "bg-muted text-muted-foreground"}`}>
            {badge?.label ?? c.status}
          </span>
        );
      },
    },
    {
      header: "Programada",
      hideOnMobile: true,
      accessor: (c) =>
        c.scheduled_at
          ? new Date(c.scheduled_at).toLocaleString("es-AR", {
              timeZone: LOCAL_TIMEZONE,
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
    },
    {
      header: "Destinatarios",
      hideOnMobile: true,
      accessor: (c) => <span>{c.total_recipients || "—"}</span>,
    },
    {
      header: "Enviados",
      hideOnMobile: true,
      accessor: (c) =>
        c.status === "completed" || c.status === "failed" ? (
          <span className="text-sm">
            {c.sent_count}
            {c.failed_count > 0 && (
              <span className="ml-1 text-red-500">({c.failed_count} errores)</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "Acciones",
      accessor: (c) => (
        <div className="flex gap-3 text-sm">
          <Link href={`/backoffice/automatizaciones/${c.id}`} className="text-primary hover:underline">
            Ver
          </Link>
          {c.status === "draft" && (
            <Link href={`/backoffice/automatizaciones/${c.id}/editar`} className="text-muted-foreground hover:underline">
              Editar
            </Link>
          )}
          <form action={cloneCampaign.bind(null, c.id)} className="inline">
            <button type="submit" className="text-muted-foreground hover:underline">
              Clonar
            </button>
          </form>
          {c.status === "scheduled" && (
            <form action={cancelSchedule.bind(null, c.id)} className="inline">
              <button type="submit" className="text-yellow-600 hover:underline">
                Cancelar
              </button>
            </form>
          )}
          {c.status === "draft" && (
            <ConfirmDeleteForm
              action={deleteCampaign.bind(null, c.id)}
              className="inline"
              message="¿Eliminar esta campaña?"
            >
              <button type="submit" className="text-red-600 hover:underline">
                Eliminar
              </button>
            </ConfirmDeleteForm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automatizaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Campañas de WhatsApp programadas</p>
        </div>
        <Link
          href="/backoffice/automatizaciones/nueva"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Nueva campaña
        </Link>
      </div>

      <ResponsiveTable
        columns={columns}
        data={campaigns}
        keyExtractor={(c) => c.id}
        emptyMessage="No hay campañas aún. Creá tu primera campaña."
      />
    </div>
  );
}
