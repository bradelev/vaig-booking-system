import PageHeader from "@/components/backoffice/page-header";
import SegmentacionClient from "./segmentacion-client";

export const metadata = { title: "Segmentación — VAIG" };

export default function SegmentacionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Segmentación de clientes"
        subtitle="Filtrá por segmento, actividad, servicio, ticket, fuente y oportunidad. Seleccioná las clientas y creá una campaña o exportá la lista."
      />
      <SegmentacionClient />
    </div>
  );
}
