import type { Metadata } from "next";
import Link from "next/link";
import CampaignForm from "@/components/backoffice/campaign-form";

export const metadata: Metadata = { title: "Nueva campaña" };

export default function NuevaCampanaPage() {
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

      <CampaignForm />
    </div>
  );
}
