"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyClientCancellation } from "@/lib/bot/notifications";

export type CancellationReason =
  | "client_request"
  | "professional_unavailable"
  | "scheduling_conflict"
  | "other";

export async function cancelBooking(
  id: string,
  reason: CancellationReason,
  note: string | null,
  cancelledBy: "admin" | "client"
) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: booking, error: fetchError } = await client
    .from("bookings")
    .select(
      `id, scheduled_at,
       clients(phone, first_name, last_name),
       services(name)`
    )
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const { error } = await client
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancellation_note: note,
      cancelled_by: cancelledBy,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (cancelledBy === "admin" && booking?.clients?.phone) {
    void notifyClientCancellation({
      clientPhone: booking.clients.phone,
      clientName: `${booking.clients.first_name ?? ""} ${booking.clients.last_name ?? ""}`.trim(),
      serviceName: booking.services?.name ?? "el servicio",
      scheduledAt: booking.scheduled_at,
      reason,
    });
  }

  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice");
}

export async function updateBookingStatus(id: string, status: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // VBS-68: If marking as realized, increment sessions_used on associated pack
  if (status === "realized") {
    const { data: booking } = await client
      .from("bookings")
      .select("client_package_id")
      .eq("id", id)
      .single();

    if (booking?.client_package_id) {
      const { data: cp } = await client
        .from("client_packages")
        .select("sessions_used")
        .eq("id", booking.client_package_id)
        .single();

      if (cp) {
        await client
          .from("client_packages")
          .update({ sessions_used: cp.sessions_used + 1 })
          .eq("id", booking.client_package_id);
      }
    }
  }

  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice");
}

export async function createBooking(formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client.from("bookings").insert({
    client_id: formData.get("client_id") as string,
    service_id: formData.get("service_id") as string,
    professional_id: (formData.get("professional_id") as string) || null,
    scheduled_at: formData.get("scheduled_at") as string,
    notes: (formData.get("notes") as string) || null,
    status: "confirmed",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice");
  redirect("/backoffice/citas");
}

export async function updateBooking(id: string, formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("bookings")
    .update({
      client_id: formData.get("client_id") as string,
      service_id: formData.get("service_id") as string,
      professional_id: (formData.get("professional_id") as string) || null,
      scheduled_at: formData.get("scheduled_at") as string,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice");
  redirect("/backoffice/citas");
}
