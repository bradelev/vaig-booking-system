"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createClient_(formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client.from("clients").insert({
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
    email: (formData.get("email") as string) || null,
    notes: (formData.get("notes") as string) || null,
    source: (formData.get("source") as string) || "manual",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/clientes");
  redirect("/backoffice/clientes");
}

export async function toggleClientBlocked(id: string, blocked: boolean) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("clients")
    .update({ is_blocked: blocked })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/clientes");
  revalidatePath(`/backoffice/clientes/${id}/editar`);
}

export async function updateClient_(id: string, formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("clients")
    .update({
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || null,
      notes: (formData.get("notes") as string) || null,
      source: (formData.get("source") as string) || "manual",
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/clientes");
  redirect("/backoffice/clientes");
}
