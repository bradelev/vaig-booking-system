"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createContacto(clientId: string, formData: FormData) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error } = await client.from("contactos").insert({
    client_id: clientId,
    fecha: formData.get("fecha") as string,
    canal: formData.get("canal") as string,
    motivo: (formData.get("motivo") as string) || null,
    resultado: (formData.get("resultado") as string) || null,
    notas: (formData.get("notas") as string) || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/backoffice/clientes/${clientId}`);
}
