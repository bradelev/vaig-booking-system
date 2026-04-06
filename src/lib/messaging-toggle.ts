import { getConfigValue } from "@/lib/config";

export type MessagingMode = "off" | "admin_only" | "all";

export async function getMessagingMode(featureKey: string): Promise<MessagingMode> {
  const val = await getConfigValue(featureKey, "off");
  if (val === "all" || val === "admin_only") return val as MessagingMode;
  return "off";
}

/**
 * Returns whether a message should be sent and to which phone number.
 * - "off"        → don't send
 * - "admin_only" → send to admin phone (for testing)
 * - "all"        → send to the actual recipient
 */
export async function shouldSendMessage(
  featureKey: string,
  recipientPhone: string
): Promise<{ send: boolean; phone: string }> {
  const mode = await getMessagingMode(featureKey);
  if (mode === "off") return { send: false, phone: recipientPhone };
  if (mode === "admin_only") {
    const adminPhone = await getConfigValue("admin_phone", "");
    if (!adminPhone.trim()) return { send: false, phone: recipientPhone };
    return { send: true, phone: adminPhone.trim() };
  }
  return { send: true, phone: recipientPhone };
}
