"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clearConfigCache } from "@/lib/config";
import { TEMPLATE_KEYS } from "@/lib/templates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

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
