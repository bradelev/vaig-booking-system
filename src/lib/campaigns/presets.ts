import type { SegmentationFilterCriteria } from "@/actions/segmentacion";
import { DEFAULT_COOLDOWN_DAYS } from "./constants";

export interface SegmentationPreset {
  id: string;
  nombre: string;
  descripcion: string;
  filtros: SegmentationFilterCriteria;
}

export const SEGMENTATION_PRESETS: SegmentationPreset[] = [
  {
    id: "reactivar-dormidas",
    nombre: "Reactivar dormidas",
    descripcion: "S1 Dormido · Inactivas/Perdidas · 90–365 días sin visita",
    filtros: {
      segmentos: ["S1"],
      categorias: ["inactiva", "perdida"],
      diasInactivoMin: 90,
      diasInactivoMax: 365,
      excluirContactadasRecientemente: true,
      cooldownDias: DEFAULT_COOLDOWN_DAYS,
    },
  },
  {
    id: "cross-sell-facial",
    nombre: "Cross-sell facial",
    descripcion: "S3 Cross-sell · Activas/En riesgo · Con oportunidad cross-sell",
    filtros: {
      segmentos: ["S3"],
      categorias: ["activa", "en_riesgo"],
      soloOportunidadCrossSell: true,
      excluirContactadasRecientemente: true,
      cooldownDias: DEFAULT_COOLDOWN_DAYS,
    },
  },
  {
    id: "vip-del-mes",
    nombre: "VIP del mes",
    descripcion: "S5 VIP · Activas/En riesgo · Cooldown 30 días",
    filtros: {
      segmentos: ["S5"],
      categorias: ["activa", "en_riesgo"],
      excluirContactadasRecientemente: true,
      cooldownDias: 30,
    },
  },
  {
    id: "primera-visita-sin-retorno",
    nombre: "1ra visita sin retorno",
    descripcion: "S4 1ra visita · En riesgo/Inactivas · Solo 1 sesión",
    filtros: {
      segmentos: ["S4"],
      categorias: ["en_riesgo", "inactiva"],
      totalSesionesMin: 1,
      totalSesionesMax: 1,
      excluirContactadasRecientemente: true,
      cooldownDias: DEFAULT_COOLDOWN_DAYS,
    },
  },
  {
    id: "cuponeras-a-convertir",
    nombre: "Cuponeras a convertir",
    descripcion: "S2 Cuponera · Activas · 2+ sesiones",
    filtros: {
      segmentos: ["S2"],
      categorias: ["activa"],
      totalSesionesMin: 2,
      excluirContactadasRecientemente: true,
      cooldownDias: DEFAULT_COOLDOWN_DAYS,
    },
  },
];
