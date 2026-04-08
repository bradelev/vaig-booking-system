export const SEGMENTO_BADGE: Record<string, { label: string; cls: string }> = {
  S5: { label: "S5 VIP", cls: "border-purple-200 bg-purple-50 text-purple-800" },
  S4: { label: "S4 1ra visita", cls: "border-blue-200 bg-blue-50 text-blue-800" },
  S3: { label: "S3 Cross-sell", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  S2: { label: "S2 Cuponera", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  S1: { label: "S1 Dormido", cls: "border-red-200 bg-red-50 text-red-800" },
};

export const SEGMENTO_OPTIONS = [
  { label: "Todos los segmentos", value: "" },
  { label: "S5 VIP", value: "S5" },
  { label: "S4 1ra visita", value: "S4" },
  { label: "S3 Cross-sell", value: "S3" },
  { label: "S2 Cuponera", value: "S2" },
  { label: "S1 Dormido", value: "S1" },
  { label: "Sin segmento", value: "none" },
];

export const SEGMENTO_FILTER_OPTIONS = [
  { label: "S5 VIP", value: "S5" },
  { label: "S4 1ra visita", value: "S4" },
  { label: "S3 Cross-sell", value: "S3" },
  { label: "S2 Cuponera", value: "S2" },
  { label: "S1 Dormido", value: "S1" },
  { label: "Sin segmento", value: "none" },
];

export const CATEGORIA_OPTIONS = [
  { label: "Activa", value: "activa" },
  { label: "En riesgo", value: "en_riesgo" },
  { label: "Inactiva", value: "inactiva" },
  { label: "Perdida", value: "perdida" },
  { label: "Sin visitas", value: "sin_visitas" },
];
