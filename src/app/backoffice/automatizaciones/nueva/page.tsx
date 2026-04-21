import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CampaignForm from "@/components/backoffice/campaign-form";

export const metadata: Metadata = { title: "Nueva campaña" };

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export default async function NuevaCampanaPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone")
    .eq("is_blocked", false)
    .order("first_name");

  const clients = (data ?? []) as Client[];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/backoffice/automatizaciones"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Campañas
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Nueva campaña</h1>
      </div>

      <CampaignForm clients={clients} />
    </div>
  );
}
