"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clearConfigCache } from "@/lib/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

export async function upsertProfessionalSchedule(professionalId: string, formData: FormData) {
  const supabase = await createClient();
  const client = supabase as AnyClient;

  const rows = DAYS.map((day) => {
    const isWorking = formData.get(`is_working_${day.value}`) === "on";
    const startTime = (formData.get(`start_time_${day.value}`) as string) || "09:00";
    const endTime = (formData.get(`end_time_${day.value}`) as string) || "18:00";
    return {
      professional_id: professionalId,
      day_of_week: day.value,
      start_time: startTime,
      end_time: endTime,
      is_working: isWorking,
    };
  });

  // Delete existing and re-insert
  await client.from("professional_schedule").delete().eq("professional_id", professionalId);
  await client.from("professional_schedule").insert(rows);

  revalidatePath(`/backoffice/profesionales/${professionalId}/horario`);
}

export async function saveSystemConfig(formData: FormData) {
  const supabase = await createClient();
  const client = supabase as AnyClient;

  const keys = ["cbu", "cbu_alias", "mp_enabled", "auto_cancel_hours", "buffer_minutes", "business_name", "admin_phone"];

  for (const key of keys) {
    const value = (formData.get(key) as string) ?? "";
    await client
      .from("system_config")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  clearConfigCache();
  revalidatePath("/backoffice/configuracion");
}
