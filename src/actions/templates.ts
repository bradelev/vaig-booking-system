"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clearConfigCache } from "@/lib/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export const TEMPLATE_KEYS = [
  "template_reminder",
  "template_survey",
  "template_cancel_client",
  "template_pack_purchased",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  template_reminder: "Recordatorio de turno (24h)",
  template_survey: "Encuesta post-atención",
  template_cancel_client: "Cancelación de turno (cliente)",
  template_pack_purchased: "Confirmación compra de pack",
};

export const TEMPLATE_PLACEHOLDERS: Record<TemplateKey, string[]> = {
  template_reminder: ["{firstName}", "{serviceName}", "{businessName}", "{dateLabel}"],
  template_survey: ["{firstName}", "{serviceName}", "{businessName}", "{surveyUrl}"],
  template_cancel_client: ["{firstName}", "{serviceName}", "{dateLabel}", "{reasonText}"],
  template_pack_purchased: ["{firstName}", "{packName}", "{serviceName}", "{sessionsTotal}"],
};

export async function saveTemplates(formData: FormData) {
  const supabase = await createClient();
  const client = supabase as AnyClient;

  for (const key of TEMPLATE_KEYS) {
    const value = (formData.get(key) as string) ?? "";
    await client
      .from("system_config")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  clearConfigCache();
  revalidatePath("/backoffice/templates");
}
