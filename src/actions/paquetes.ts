"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export async function createPackage(formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await (client.from("service_packages") as { insert: (v: AnyRecord) => Promise<{ error: Error | null }> }).insert({
    name: formData.get("name") as string,
    service_id: formData.get("service_id") as string,
    session_count: Number(formData.get("session_count")),
    price: Number(formData.get("price")),
    is_active: true,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/paquetes");
  redirect("/backoffice/paquetes");
}

export async function updatePackage(id: string, formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("service_packages")
    .update({
      name: formData.get("name") as string,
      service_id: formData.get("service_id") as string,
      session_count: Number(formData.get("session_count")),
      price: Number(formData.get("price")),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/paquetes");
  redirect("/backoffice/paquetes");
}

export async function togglePackageActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("service_packages")
    .update({ is_active: !isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/paquetes");
}
