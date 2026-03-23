"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createProfessional(formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const specialtiesRaw = (formData.get("specialties") as string) || "";
  const specialties = specialtiesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const phone = (formData.get("phone") as string) || null;

  const { error } = await client.from("professionals").insert({
    name: formData.get("name") as string,
    specialties,
    phone,
    is_active: true,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/profesionales");
  redirect("/backoffice/profesionales");
}

export async function updateProfessional(id: string, formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const specialtiesRaw = (formData.get("specialties") as string) || "";
  const specialties = specialtiesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const phone = (formData.get("phone") as string) || null;

  const { error } = await client
    .from("professionals")
    .update({
      name: formData.get("name") as string,
      specialties,
      phone,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/profesionales");
  redirect("/backoffice/profesionales");
}

export async function toggleProfessionalActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client
    .from("professionals")
    .update({ is_active: !isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/profesionales");
}
