"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdminPaymentConfirmed } from "@/lib/bot/notifications";

export async function confirmPayment(bookingId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Fetch booking with client and service details
  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, scheduled_at, service_id, services(name, deposit_amount), clients(first_name, last_name, phone)")
    .eq("id", bookingId)
    .single();

  if (bookingError) throw new Error(bookingError.message);

  const depositAmount = booking?.services?.deposit_amount ?? 0;

  // Insert payment record
  const { error: paymentError } = await client.from("payments").insert({
    booking_id: bookingId,
    amount: depositAmount,
    method: "manual",
    confirmed_at: new Date().toISOString(),
  });

  if (paymentError) throw new Error(paymentError.message);

  // Update booking status
  const { error: updateError } = await client
    .from("bookings")
    .update({ status: "deposit_paid" })
    .eq("id", bookingId);

  if (updateError) throw new Error(updateError.message);

  // VBS-50: Notify admin of confirmed manual payment
  void notifyAdminPaymentConfirmed({
    bookingId,
    clientName: `${booking?.clients?.first_name ?? ""} ${booking?.clients?.last_name ?? ""}`.trim(),
    clientPhone: booking?.clients?.phone ?? "",
    serviceName: booking?.services?.name ?? "",
    scheduledAt: booking?.scheduled_at ?? new Date().toISOString(),
    amount: Number(depositAmount),
    method: "manual",
  });

  revalidatePath("/backoffice");
  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice/pagos");
}
