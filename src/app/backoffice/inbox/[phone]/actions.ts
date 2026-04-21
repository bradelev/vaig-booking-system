"use server";

import { createClient } from "@/lib/supabase/server";
import { sendTextMessage } from "@/lib/whatsapp/logged";
import { activateHandoff, releaseHandoff } from "@/lib/bot/handoff";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function sendAdminReply(
  phone: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  if (!body.trim()) return { success: false, error: "El mensaje no puede estar vacío" };

  try {
    const supabase = await createClient();
    // Verify admin is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    await sendTextMessage({ to: phone, body: body.trim() }, "admin_manual");
    return { success: true };
  } catch (err) {
    logger.error("[Inbox] Failed to send admin reply", { phone, error: err instanceof Error ? err.message : String(err) });
    return { success: false, error: err instanceof Error ? err.message : "Error al enviar" };
  }
}

export async function activateHandoffAction(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    await activateHandoff(phone);
    return { success: true };
  } catch (err) {
    logger.error("[Inbox] Failed to activate handoff", { phone, error: err instanceof Error ? err.message : String(err) });
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function releaseHandoffAction(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    await releaseHandoff(phone);
    return { success: true };
  } catch (err) {
    logger.error("[Inbox] Failed to release handoff", { phone, error: err instanceof Error ? err.message : String(err) });
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function markAsRead(phone: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase as AnyClient)
      .from("messages")
      .update({ admin_read_at: new Date().toISOString() })
      .eq("phone", phone)
      .eq("direction", "inbound")
      .is("admin_read_at", null);
  } catch (err) {
    logger.error("[Inbox] Failed to mark as read", { phone, error: err instanceof Error ? err.message : String(err) });
  }
}
