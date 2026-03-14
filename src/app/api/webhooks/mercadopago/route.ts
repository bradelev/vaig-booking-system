import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { fetchMPPayment } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

function verifySignature(
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
  const bookingId = payment.external_reference;

  if (!bookingId) {
    console.warn("[MP Webhook] Payment without external_reference:", paymentId);
    return;
  }

  const supabase = await createClient();

  if (payment.status === "approved") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("bookings")
      .update({
        status: "deposit_paid",
        deposit_paid_at: payment.date_approved ?? new Date().toISOString(),
      })
      .eq("id", bookingId)
      .eq("status", "pending"); // Only update if still pending

    if (error) {
      console.error("[MP Webhook] Failed to update booking:", error);
    } else {
      console.log(`[MP Webhook] Booking ${bookingId} marked as deposit_paid`);
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
