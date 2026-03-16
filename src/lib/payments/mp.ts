/**
 * Mercado Pago preference creation for deposit payments.
 */

export interface MPPreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

export interface CreateMPPreferenceParams {
  bookingId: string;
  serviceTitle: string;
  depositAmount: number;
  expiresAt: Date; // preference expiry
  payerEmail?: string;
}

export interface MPPreferenceResult {
  id: string;
  initPoint: string; // checkout URL
}

export interface CreatePackMPPreferenceParams {
  clientPackageId: string;
  packName: string;
  price: number;
  payerEmail?: string;
}

export async function createPackMPPreference(
  params: CreatePackMPPreferenceParams
): Promise<MPPreferenceResult> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vaig.com.ar";

  const body = {
    items: [
      {
        title: `Pack — ${params.packName}`,
        quantity: 1,
        unit_price: params.price,
        currency_id: "ARS",
      },
    ],
    external_reference: `pack:${params.clientPackageId}`,
    back_urls: {
      success: `${appUrl}/reserva/gracias`,
      failure: `${appUrl}/reserva/error`,
      pending: `${appUrl}/reserva/pendiente`,
    },
    auto_return: "approved",
    notification_url: `${appUrl}/api/webhooks/mercadopago`,
    ...(params.payerEmail && { payer: { email: params.payerEmail } }),
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`MercadoPago preferences error ${res.status}: ${error}`);
  }

  const data = await res.json() as { id: string; init_point: string };
  return { id: data.id, initPoint: data.init_point };
}

export async function createMPPreference(
  params: CreateMPPreferenceParams
): Promise<MPPreferenceResult> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vaig.com.ar";

  const body = {
    items: [
      {
        title: `Seña — ${params.serviceTitle}`,
        quantity: 1,
        unit_price: params.depositAmount,
        currency_id: "ARS",
      },
    ],
    external_reference: params.bookingId,
    expiration_date_to: params.expiresAt.toISOString(),
    back_urls: {
      success: `${appUrl}/reserva/gracias`,
      failure: `${appUrl}/reserva/error`,
      pending: `${appUrl}/reserva/pendiente`,
    },
    auto_return: "approved",
    notification_url: `${appUrl}/api/webhooks/mercadopago`,
    ...(params.payerEmail && { payer: { email: params.payerEmail } }),
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`MercadoPago preferences error ${res.status}: ${error}`);
  }

  const data = await res.json() as { id: string; init_point: string };
  return { id: data.id, initPoint: data.init_point };
}
