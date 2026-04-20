"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SegmentationClient, SegmentationFilterCriteria } from "@/actions/segmentacion";
import { Copy, Download, Megaphone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SegmentacionBulkActionsProps {
  selectedIds: Set<string>;
  clients: SegmentationClient[];
  criteria: SegmentationFilterCriteria;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("598")) return `+${digits}`;
  if (digits.startsWith("09") || digits.startsWith("0")) return `+598${digits.slice(1)}`;
  return `+598${digits}`;
}

export default function SegmentacionBulkActions({
  selectedIds,
  clients,
  criteria,
}: SegmentacionBulkActionsProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const selected = clients.filter((c) => selectedIds.has(c.id));

  function handleCopyPhones() {
    const lines = selected.map((c) => normalizePhone(c.phone)).join("\n");
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(lines).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  function handleExportCsv() {
    const BOM = "\uFEFF";
    const header = ["Nombre", "Apellido", "Teléfono", "Segmento", "Categoría", "Sesiones", "Días inact.", "Ticket prom.", "Fuente"];
    const rows = selected.map((c) => [
      c.first_name,
      c.last_name,
      normalizePhone(c.phone),
      c.segmento ?? "",
      c.categoria ?? "",
      c.total_sesiones,
      c.dias_inactivo ?? "",
      c.ticket_promedio ?? "",
      c.source ?? "",
    ]);

    const csvContent =
      BOM +
      [header, ...rows]
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `segmentacion-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function handleCreateCampaign() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "segmentacion_handoff",
        JSON.stringify({ criteria, selectedIds: Array.from(selectedIds) })
      );
    }
    router.push("/backoffice/automatizaciones/nueva?from_segment=1");
  }

  if (selectedIds.size === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
      <span className="text-sm font-medium text-primary mr-2">
        {selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}
      </span>

      <Button variant="outline" size="sm" onClick={handleCopyPhones} className="gap-1.5">
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copiados" : "Copiar teléfonos"}
      </Button>

      <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5">
        <Download className="h-3.5 w-3.5" />
        Exportar CSV
      </Button>

      <Button size="sm" onClick={handleCreateCampaign} className="gap-1.5">
        <Megaphone className="h-3.5 w-3.5" />
        Crear campaña
      </Button>
    </div>
  );
}
