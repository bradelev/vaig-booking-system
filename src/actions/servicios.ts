"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { invalidateKnowledgeCache } from "@/lib/bot/knowledge";

export async function createService(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("services").insert({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    duration_minutes: Number(formData.get("duration_minutes")),
    price: Number(formData.get("price")),
    deposit_amount: Number(formData.get("deposit_amount")),
    default_professional_id: (formData.get("default_professional_id") as string) || null,
    is_active: true,
  });

  if (error) throw new Error(error.message);

  invalidateKnowledgeCache();
  revalidatePath("/backoffice/servicios");
  redirect("/backoffice/servicios");
}

export async function updateService(id: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
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

  invalidateKnowledgeCache();
  revalidatePath("/backoffice/servicios");
  redirect("/backoffice/servicios");
}

export async function updateServiceInline(
  id: string,
  data: { name: string; price: number }
): Promise<{ success: boolean; error?: string }> {
  if (!data.name || data.name.trim() === "") {
    return { success: false, error: "El nombre no puede estar vacío" };
  }
  if (!Number.isFinite(data.price) || data.price <= 0) {
    return { success: false, error: "El precio debe ser un número positivo" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("services")
    .update({ name: data.name.trim(), price: data.price })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  invalidateKnowledgeCache();
  revalidatePath("/backoffice/servicios");
  return { success: true };
}

export async function toggleServiceActive(id: string, isActive: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("services")
    .update({ is_active: !isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);

  invalidateKnowledgeCache();
  revalidatePath("/backoffice/servicios");
}
