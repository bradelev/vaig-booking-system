import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/backoffice/page-header";
import { getDuplicadosCandidatos } from "@/actions/clientes";
import DuplicadosClient from "./duplicados-client";

export const metadata: Metadata = { title: "Clientes duplicados" };

export default async function DuplicadosPage() {
  const pares = await getDuplicadosCandidatos();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/backoffice/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>
      </div>

      <PageHeader
        title="Clientes duplicados"
        subtitle={`${pares.length} pares candidatos detectados por similitud de nombre`}
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Revisar antes de fusionar.</strong> Se detectan pares por similitud de nombre
        (variantes con/sin acentos y typos). Algunos pueden ser personas distintas — usá{" "}
        <em>Ignorar</em> para descartar falsos positivos.
      </div>

      <DuplicadosClient pares={pares} />
    </div>
  );
}
