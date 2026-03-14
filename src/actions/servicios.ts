"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export async function createService(formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await (client.from("services") as { insert: (v: AnyRecord) => Promise<{ error: Error | null }> }).insert({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    duration_minutes: Number(formData.get("duration_minutes")),
    price: Number(formData.get("price")),
    deposit_amount: Number(formData.get("deposit_amount")),
    default_professional_id: (formData.get("default_professional_id") as string) || null,
    is_active: true,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/servicios");
  redirect("/backoffice/servicios");
}

export async function updateService(id: string, formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("services")
    .update({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      duration_minutes: Number(formData.get("duration_minutes")),
      price: Number(formData.get("price")),
      deposit_amount: Number(formData.get("deposit_amount")),
      default_professional_id: (formData.get("default_professional_id") as string) || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/servicios");
  redirect("/backoffice/servicios");
}

export async function toggleServiceActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("services")
    .update({ is_active: !isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/servicios");
}
