/**
 * Conversation session management — reads/writes to conversation_sessions table.
 */
import { createClient } from "@/lib/supabase/server";
import type { BotConversationState, BookingFlowContext } from "./types";

export interface ConversationSession {
  id: string;
  phone: string;
  state: BotConversationState;
  context: BookingFlowContext;
  lastMessageAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function getSession(phone: string): Promise<ConversationSession | null> {
  const supabase = await createClient();
  const client = supabase as AnyClient;

  const { data } = await client
    .from("conversation_sessions")
    .select("id, phone, state, context_json, last_message_at")
    .eq("phone", phone)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    phone: data.phone as string,
    state: (data.state as BotConversationState) ?? "idle",
    context: (data.context_json as BookingFlowContext) ?? {},
    lastMessageAt: new Date(data.last_message_at as string),
  };
}

export async function upsertSession(
  phone: string,
  state: BotConversationState,
  context: BookingFlowContext
): Promise<void> {
  const supabase = await createClient();
  const client = supabase as AnyClient;

  // Check if session exists
  const { data: existing } = await client
    .from("conversation_sessions")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing?.id) {
    await client
      .from("conversation_sessions")
      .update({ state, context_json: context, last_message_at: now })
      .eq("id", existing.id);
  } else {
    await client.from("conversation_sessions").insert({
      phone,
      state,
      context_json: context,
      last_message_at: now,
    });
  }
}

export async function clearSession(phone: string): Promise<void> {
  const supabase = await createClient();
  const client = supabase as AnyClient;

  await client.from("conversation_sessions").delete().eq("phone", phone);
}
