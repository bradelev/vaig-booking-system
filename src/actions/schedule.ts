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

export async function createScheduleOverride(professionalId: string, formData: FormData) {
  const supabase = await createClient();
  const client = supabase as AnyClient;

  const isWorking = formData.get("is_working") === "on";
  const overrideDate = formData.get("override_date") as string;
  const startTime = (formData.get("start_time") as string) || null;
  const endTime = (formData.get("end_time") as string) || null;
  const reason = (formData.get("reason") as string) || null;

  const { error } = await client
    .from("professional_schedule_overrides")
    .upsert(
      {
        professional_id: professionalId,
        override_date: overrideDate,
        start_time: isWorking ? startTime : null,
        end_time: isWorking ? endTime : null,
        is_working: isWorking,
        reason,
      },
      { onConflict: "professional_id,override_date" }
    );

  if (error) throw new Error(error.message);

  revalidatePath(`/backoffice/profesionales/${professionalId}/horario`);
}

export async function deleteScheduleOverride(professionalId: string, overrideId: string) {
  const supabase = await createClient();
  const client = supabase as AnyClient;

  const { error } = await client
    .from("professional_schedule_overrides")
    .delete()
    .eq("id", overrideId)
    .eq("professional_id", professionalId);

  if (error) throw new Error(error.message);

  revalidatePath(`/backoffice/profesionales/${professionalId}/horario`);
}

export async function saveSystemConfig(formData: FormData) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const client = createAdminClient() as AnyClient;

  const keys = [
    "business_name", "admin_phone",
    // Bot/payment keys hidden from UI in backoffice-only mode — do not save to avoid overwriting with empty:
    // "cbu", "cbu_alias", "mp_enabled", "auto_cancel_hours", "buffer_minutes",
    // "messaging_reminder", "messaging_survey", "messaging_payment_reminder", "messaging_next_session",
    // "messaging_cancel_notification", "messaging_pack_notification", "messaging_waitlist",
  ];

  for (const key of keys) {
    const value = (formData.get(key) as string) ?? "";
    await client
      .from("system_config")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  clearConfigCache();
  revalidatePath("/backoffice/configuracion");
}
