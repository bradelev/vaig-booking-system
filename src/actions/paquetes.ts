"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { invalidateKnowledgeCache } from "@/lib/bot/knowledge";

export async function createPackage(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("service_packages").insert({
    name: formData.get("name") as string,
    service_id: formData.get("service_id") as string,
    session_count: Number(formData.get("session_count")),
    price: Number(formData.get("price")),
    is_active: true,
  });

  if (error) throw new Error(error.message);

  invalidateKnowledgeCache();
  revalidatePath("/backoffice/paquetes");
  redirect("/backoffice/paquetes");
}

export async function updatePackage(id: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("service_packages")
    .update({
      name: formData.get("name") as string,
      service_id: formData.get("service_id") as string,
      session_count: Number(formData.get("session_count")),
      price: Number(formData.get("price")),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  invalidateKnowledgeCache();
  revalidatePath("/backoffice/paquetes");
  redirect("/backoffice/paquetes");
}

export async function togglePackageActive(id: string, isActive: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("service_packages")
    .update({ is_active: !isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);

  invalidateKnowledgeCache();
  revalidatePath("/backoffice/paquetes");
}
