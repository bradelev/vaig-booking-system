// Mercado Pago payment utilities

export type MPPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export interface MPPayment {
  id: number;
  status: MPPaymentStatus;
  status_detail: string;
  external_reference: string; // booking_id
  transaction_amount: number;
  currency_id: string;
  date_approved: string | null;
  date_created: string;
  payer: {
    email: string;
    identification?: { type: string; number: string };
  };
}

export async function fetchMPPayment(paymentId: string | number): Promise<MPPayment> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`MercadoPago API error ${res.status}: ${error}`);
  }

  return res.json() as Promise<MPPayment>;
}
