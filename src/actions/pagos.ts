"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function confirmPayment(bookingId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Fetch booking to get deposit_amount via service
  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, service_id, services(deposit_amount)")
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

  revalidatePath("/backoffice");
  revalidatePath("/backoffice/citas");
}
