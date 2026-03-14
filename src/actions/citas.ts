"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateBookingStatus(id: string, status: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

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
