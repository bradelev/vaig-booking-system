export interface MetodoPago {
  value: string;
  label: string;
}

export const METODOS_PAGO: MetodoPago[] = [
  { value: "", label: "— Sin método —" },
  { value: "Transferencia", label: "Transferencia" },
  { value: "Efectivo", label: "Efectivo" },
  { value: "Mercado_Pago", label: "Mercado Pago" },
  { value: "Pos_débito", label: "Pos débito" },
  { value: "Pos_crédito", label: "Pos crédito" },
  { value: "Cuponera", label: "Cuponera" },
  { value: "Canje", label: "Canje" },
  { value: "Regalo", label: "Regalo" },
];

export const METODOS_CON_BANCO: readonly string[] = [
  "Transferencia",
  "Pos_débito",
  "Pos_crédito",
];
