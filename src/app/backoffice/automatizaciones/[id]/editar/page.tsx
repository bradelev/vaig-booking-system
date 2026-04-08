import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CampaignForm from "@/components/backoffice/campaign-form";

export const metadata: Metadata = { title: "Editar campaña" };

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  consent_accepted_at: string | null;
}

export default async function EditarCampanaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: campaignRaw }, { data: recipientsRaw }, { data: clientsWithConsent }] = await Promise.all([
    db.from("campaigns")
      .select("id, name, body, image_url, scheduled_at, target_all, status, filter_criteria")
      .eq("id", id)
      .single(),
    db.from("campaign_recipients")
      .select("client_id")
      .eq("campaign_id", id),
    db.from("clients")
      .select("id, first_name, last_name, phone, consent_accepted_at")
      .eq("is_blocked", false)
      .order("first_name"),
  ]);

  if (!campaignRaw) notFound();
  if (campaignRaw.status !== "draft") {
    // Redirect to detail view for non-draft campaigns
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

  const recipientIds = (recipientsRaw ?? []).map((r: { client_id: string }) => r.client_id);

  let clients: Client[];
  if (clientsWithConsent) {
    clients = clientsWithConsent as Client[];
  } else {
    // Fallback: consent_accepted_at column may not exist in DB yet
    const { data: withoutConsent } = await db
      .from("clients")
      .select("id, first_name, last_name, phone")
      .eq("is_blocked", false)
      .order("first_name");
    clients = ((withoutConsent ?? []) as Array<Omit<Client, "consent_accepted_at">>).map(
      (c) => ({ ...c, consent_accepted_at: null }),
    );
  }

  const campaign = {
    ...campaignRaw,
    recipient_ids: recipientIds,
  };

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

      <CampaignForm clients={clients} campaign={campaign} />
    </div>
  );
}
