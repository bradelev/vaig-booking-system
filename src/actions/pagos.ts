"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdminPaymentConfirmed } from "@/lib/bot/notifications";

export async function confirmPayment(bookingId: string) {
  const supabase = await createClient();

  // Fetch booking with client and service details
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, scheduled_at, service_id, services(name, deposit_amount), clients(first_name, last_name, phone)")
    .eq("id", bookingId)
    .single();

  if (bookingError) throw new Error(bookingError.message);

  type BookingRow = {
    id: string;
    scheduled_at: string;
    service_id: string;
    services: { name: string; deposit_amount: number } | null;
    clients: { first_name: string; last_name: string; phone: string } | null;
  };
  const b = booking as unknown as BookingRow | null;
  const depositAmount = b?.services?.deposit_amount ?? 0;

  // Insert payment record
  const { error: paymentError } = await supabase.from("payments").insert({
    booking_id: bookingId,
    amount: depositAmount,
    method: "manual",
    confirmed_at: new Date().toISOString(),
  });

  if (paymentError) throw new Error(paymentError.message);

  // Update booking status
  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "deposit_paid" })
    .eq("id", bookingId);

  if (updateError) throw new Error(updateError.message);

  // VBS-50: Notify admin of confirmed manual payment
  void notifyAdminPaymentConfirmed({
    bookingId,
    clientName: `${b?.clients?.first_name ?? ""} ${b?.clients?.last_name ?? ""}`.trim(),
    clientPhone: b?.clients?.phone ?? "",
    serviceName: b?.services?.name ?? "",
    scheduledAt: b?.scheduled_at ?? new Date().toISOString(),
    amount: Number(depositAmount),
    method: "manual",
  });

  revalidatePath("/backoffice");
  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice/pagos");
}
