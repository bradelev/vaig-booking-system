import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CampaignForm from "@/components/backoffice/campaign-form";
import { filterCampaignClients, type CampaignFilterCriteria } from "@/actions/campaigns";

export const metadata: Metadata = { title: "Editar campaña" };

export default async function EditarCampanaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  type CampaignRaw = {
    id: string;
    name: string;
    body: string;
    image_url: string | null;
    scheduled_at: string | null;
    target_all: boolean;
    status: string;
    filter_criteria: CampaignFilterCriteria | null;
  };

  const [{ data: rawCampaign }, { data: rawRecipients }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, body, image_url, scheduled_at, target_all, status, filter_criteria")
      .eq("id", id)
      .single(),
    supabase.from("campaign_recipients").select("client_id").eq("campaign_id", id),
  ]);

  const campaignRaw = rawCampaign as unknown as CampaignRaw | null;

  if (!campaignRaw) notFound();
  if (campaignRaw.status !== "draft") {
    return (
      <div className="max-w-5xl space-y-4">
        <Link href={`/backoffice/automatizaciones/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver a la campaña
        </Link>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          Esta campaña no está en estado borrador y no puede editarse.{" "}
          <Link href={`/backoffice/automatizaciones/${id}`} className="underline font-medium">
            Ver detalle
          </Link>
        </div>
      </div>
    );
  }

  const recipientIds = (rawRecipients ?? []).map((r: { client_id: unknown }) => r.client_id as string);

  // Resolve initial recipients as concrete client rows for the Excel table.
  // Legacy campaigns with target_all=true or filter_criteria are materialized here so the form
  // always shows a manual list — saving converts them to explicit recipients.
  let initialRecipients: { id: string; first_name: string; last_name: string | null; phone: string }[] = [];

  if (recipientIds.length > 0) {
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, first_name, last_name, phone")
      .in("id", recipientIds);
    initialRecipients = (clientRows ?? []) as typeof initialRecipients;
  } else if (campaignRaw.target_all || campaignRaw.filter_criteria) {
    // Resolve filter-based or all-clients campaign to an explicit list
    const criteria = campaignRaw.filter_criteria ?? {};
    const result = await filterCampaignClients(criteria);
    initialRecipients = result.clients.map((c) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name ?? null,
      phone: c.phone,
    }));
  }

  const campaign = {
    ...campaignRaw,
    recipient_ids: recipientIds,
    initialRecipients,
  };

  const isLegacy = campaignRaw.target_all || (campaignRaw.filter_criteria && recipientIds.length === 0);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/backoffice/automatizaciones/${id}`}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Campaña
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Editar campaña</h1>
      </div>

      {isLegacy && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Esta campaña usaba destinatarios por filtro. Al guardar se convertirá a lista manual con los clientes resueltos.
        </div>
      )}

      <CampaignForm campaign={campaign} />
    </div>
  );
}
