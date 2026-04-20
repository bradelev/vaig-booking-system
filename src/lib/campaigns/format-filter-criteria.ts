import type { SegmentationFilterCriteria } from "@/actions/segmentacion";
import { SEGMENTO_FILTER_OPTIONS, CATEGORIA_OPTIONS } from "@/lib/constants/segments";

export interface FilterCriteriaRow {
  label: string;
  value: string;
}

export function formatFilterCriteria(
  criteria: SegmentationFilterCriteria
): FilterCriteriaRow[] {
  const rows: FilterCriteriaRow[] = [];

  if (criteria.segmentos?.length) {
    const labels = criteria.segmentos.map((s) => {
      if (s === "none") return "Sin segmento";
      return SEGMENTO_FILTER_OPTIONS.find((o) => o.value === s)?.label ?? s;
    });
    rows.push({ label: "Segmento", value: labels.join(", ") });
  }

  if (criteria.categorias?.length) {
    const labels = criteria.categorias.map(
      (c) => CATEGORIA_OPTIONS.find((o) => o.value === c)?.label ?? c
    );
    rows.push({ label: "Actividad", value: labels.join(", ") });
  }

  if (criteria.serviceCategories?.length) {
    rows.push({ label: "Categoría servicio", value: criteria.serviceCategories.join(", ") });
  }

  if (criteria.totalSesionesMin != null || criteria.totalSesionesMax != null) {
    const min = criteria.totalSesionesMin ?? "0";
    const max = criteria.totalSesionesMax ?? "∞";
    rows.push({ label: "Sesiones", value: `${min}–${max}` });
  }

  if (criteria.diasInactivoMin != null || criteria.diasInactivoMax != null) {
    const min = criteria.diasInactivoMin ?? "0";
    const max = criteria.diasInactivoMax ?? "∞";
    rows.push({ label: "Días inactividad", value: `${min}–${max}` });
  }

  if (criteria.ticketPromedioMin != null || criteria.ticketPromedioMax != null) {
    const min = criteria.ticketPromedioMin ?? "0";
    const max = criteria.ticketPromedioMax ?? "∞";
    rows.push({ label: "Ticket promedio", value: `$${min}–$${max}` });
  }

  if (criteria.sources?.length) {
    rows.push({ label: "Fuente", value: criteria.sources.join(", ") });
  }

  if (criteria.soloOportunidadCrossSell) {
    rows.push({ label: "Oportunidades", value: "Con oportunidad cross-sell" });
  }

  if (criteria.soloCandidataReactivacion) {
    rows.push({ label: "Oportunidades", value: "Candidata a reactivación" });
  }

  const cooldownOn = criteria.excluirContactadasRecientemente !== false;
  const cooldownDays = criteria.cooldownDias ?? 21;
  rows.push({
    label: "Cooldown",
    value: cooldownOn ? `Excluidas contactadas en últimos ${cooldownDays}d` : "Sin filtro de cooldown",
  });

  return rows;
}
