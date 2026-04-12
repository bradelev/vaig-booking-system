import { createAdminClient } from "@/lib/supabase/admin";

export type MessageDirection = "inbound" | "outbound";
export type MessageType = "text" | "interactive" | "template" | "image" | "list";
export type MessageSource =
  | "bot"
  | "campaign"
  | "cron_reminder"
  | "cron_survey"
  | "cron_payment"
  | "cron_next_session"
  | "admin_manual"
  | "admin_notification"
  | "client";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

interface LogOutboundParams {
  phone: string;
  messageType: MessageType;
  body: string | null;
  source: MessageSource;
}

interface LogInboundParams {
  phone: string;
  waMessageId: string;
  messageType: MessageType;
  body: string;
}

/** Look up client_id by phone number. Returns null if not found. */
export async function resolveClientId(phone: string): Promise<string | null> {
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("clients")
    .select("id")
    .eq("phone", phone)
    .limit(1)
    .single();
  return data?.id ?? null;
}

/** Insert a pending outbound message row. Returns the row id. */
export async function logOutboundMessage({
  phone,
  messageType,
  body,
  source,
}: LogOutboundParams): Promise<string> {
  const clientId = await resolveClientId(phone);
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("messages")
    .insert({
      phone,
      client_id: clientId,
      direction: "outbound",
      message_type: messageType,
      body,
      source,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[WA Log] Failed to log outbound message:", error.message);
    throw error;
  }
  return data.id;
}

/** Update a message row with the WhatsApp message ID after successful send. */
export async function markMessageSent(rowId: string, waMessageId: string): Promise<void> {
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("messages")
    .update({ wa_message_id: waMessageId, status: "sent" })
    .eq("id", rowId);
}

/** Mark a message as failed. */
export async function markMessageFailed(rowId: string, errorMessage: string): Promise<void> {
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("messages")
    .update({ status: "failed", error_message: errorMessage })
    .eq("id", rowId);
}

/** Log an inbound message from the webhook. */
export async function logInboundMessage({
  phone,
  waMessageId,
  messageType,
  body,
}: LogInboundParams): Promise<void> {
  const clientId = await resolveClientId(phone);
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("messages")
    .upsert(
      {
        wa_message_id: waMessageId,
        phone,
        client_id: clientId,
        direction: "inbound",
        message_type: messageType,
        body,
        source: "client",
        status: "delivered",
      },
      { onConflict: "wa_message_id" }
    );
}

/** Update message delivery status from webhook status callback. */
export async function updateMessageStatus(
  waMessageId: string,
  status: MessageStatus
): Promise<void> {
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("messages")
    .update({ status })
    .eq("wa_message_id", waMessageId);
}
