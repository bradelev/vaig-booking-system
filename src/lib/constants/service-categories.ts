export const SERVICE_CATEGORIES = [
  "Masajes",
  "Facial",
  "Cejas y Pestañas",
  "Manos y Pies",
  "Depilación Láser",
  "Day Spa",
  "Aparatología / HIFU",
  "Combos",
  "Otros",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
