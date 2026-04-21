import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { fetchMPPayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminPaymentConfirmed, notifyClientPackPurchased } from "@/lib/bot/notifications";
import { logger } from "@/lib/logger";

export function verifySignature(
  payload: string,
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if secret not configured (dev mode)
  if (!xSignature) return false;

  // MP signature format: ts=<timestamp>,v1=<hash>
  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => p.split("=") as [string, string])
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId ?? ""};request-id:${xRequestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// payload parameter kept for future use (e.g. raw body logging)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handlePaymentNotification(paymentId: string, _payload?: string): Promise<void> {
  const payment = await fetchMPPayment(paymentId);
  const externalRef = payment.external_reference;

  if (!externalRef) {
    console.warn("[MP Webhook] Payment without external_reference:", paymentId);
    return;
  }

  // VBS-69: Pack purchase payments use "pack:{clientPackageId}" as external_reference
  if (externalRef.startsWith("pack:")) {
    if (payment.status !== "approved") {
      console.log(`[MP Webhook] Pack payment ${paymentId} status: ${payment.status} (no action)`);
      return;
    }

    const clientPackageId = externalRef.slice(5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    const { error } = await db
      .from("client_packages")
      .update({ paid_at: payment.date_approved ?? new Date().toISOString(), payment_reference: paymentId })
      .eq("id", clientPackageId)
      .is("paid_at", null);

    if (error) {
      logger.error("MP webhook: failed to activate client_package", { client_package_id: clientPackageId, error: error.message });
      return;
    }

    console.log(`[MP Webhook] Pack ${clientPackageId} activated`);

    // Notify client
    const { data: cpData } = await db
      .from("client_packages")
      .select("sessions_total, service_packages(name, services(name)), clients(phone, first_name, last_name)")
      .eq("id", clientPackageId)
      .single();

    if (cpData?.clients?.phone) {
      void notifyClientPackPurchased({
        clientPhone: cpData.clients.phone,
        clientName: `${cpData.clients.first_name ?? ""} ${cpData.clients.last_name ?? ""}`.trim(),
        packName: cpData.service_packages?.name ?? "Pack",
        serviceName: cpData.service_packages?.services?.name ?? "",
        sessionsTotal: cpData.sessions_total,
      });
    }
    return;
  }

  const bookingId = externalRef;

  if (payment.status === "approved") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;
    const { error } = await db
      .from("bookings")
      .update({
        status: "deposit_paid",
        deposit_paid_at: payment.date_approved ?? new Date().toISOString(),
      })
      .eq("id", bookingId)
      .eq("status", "pending"); // Only update if still pending

    if (error) {
      logger.error("MP webhook: failed to update booking", { booking_id: bookingId, payment_id: paymentId, error: error.message });
    } else {
      console.log(`[MP Webhook] Booking ${bookingId} marked as deposit_paid`);

      // VBS-50: Notify admin of confirmed payment
      const { data: bookingData } = await db
        .from("bookings")
        .select("scheduled_at, clients(first_name, last_name, phone), services(name, deposit_amount)")
        .eq("id", bookingId)
        .single();

      if (bookingData) {
        void notifyAdminPaymentConfirmed({
          bookingId,
          clientName: `${bookingData.clients?.first_name ?? ""} ${bookingData.clients?.last_name ?? ""}`.trim(),
          clientPhone: bookingData.clients?.phone ?? "",
          serviceName: bookingData.services?.name ?? "",
          scheduledAt: bookingData.scheduled_at,
          amount: Number(bookingData.services?.deposit_amount ?? 0),
          method: "mercadopago",
        });
      }
    }
  } else {
    console.log(`[MP Webhook] Payment ${paymentId} status: ${payment.status} (no action)`);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dataId =
    (body.data as Record<string, unknown> | undefined)?.id?.toString() ?? null;

  if (!verifySignature(rawBody, xSignature, xRequestId, dataId)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Only handle payment notifications
  if (body.type !== "payment" || !dataId) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // Respond 200 immediately, process async
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (globalThis as any)[Symbol.for("next.request.context")];
  if (ctx?.waitUntil) {
    ctx.waitUntil(handlePaymentNotification(dataId));
  } else {
    void handlePaymentNotification(dataId);
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
