/**
 * Conversation session management — reads/writes to conversation_sessions table.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { BotConversationState, BookingFlowContext } from "./types";

export interface ConversationSession {
  id: string;
  phone: string;
  state: BotConversationState;
  context: BookingFlowContext;
  lastMessageAt: Date;
  updatedAt: Date;
  handoffActive: boolean;
  handoffAt: Date | null;
  lastInboundAt: Date | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function getSession(phone: string): Promise<ConversationSession | null> {
  const client = createAdminClient() as AnyClient;

  const { data } = await client
    .from("conversation_sessions")
    .select("id, phone, state, context_json, last_message_at, updated_at, handoff_active, handoff_at, last_inbound_at")
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
    updatedAt: new Date((data.updated_at ?? data.last_message_at) as string),
    handoffActive: (data.handoff_active as boolean) ?? false,
    handoffAt: data.handoff_at ? new Date(data.handoff_at as string) : null,
    lastInboundAt: data.last_inbound_at ? new Date(data.last_inbound_at as string) : null,
  };
}

export async function upsertSession(
  phone: string,
  state: BotConversationState,
  context: BookingFlowContext
): Promise<void> {
  const client = createAdminClient() as AnyClient;

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
  const client = createAdminClient() as AnyClient;

  await client.from("conversation_sessions").delete().eq("phone", phone);
}

/**
 * VBS-74 — Advance the funnel stage for a phone's current session.
 * Stages (ordered): started → service_selected → data_completed → payment_done
 * Only updates if the new stage is higher than the existing one.
 */
const FUNNEL_ORDER = ["started", "service_selected", "data_completed", "payment_done"];

export async function advanceFunnel(
  phone: string,
  stage: "started" | "service_selected" | "data_completed" | "payment_done"
): Promise<void> {
  const client = createAdminClient() as AnyClient;

  const { data: existing } = await client
    .from("conversation_sessions")
    .select("id, funnel_stage")
    .eq("phone", phone)
    .maybeSingle();

  if (!existing?.id) return;

  const currentIdx = FUNNEL_ORDER.indexOf(existing.funnel_stage ?? "");
  const newIdx = FUNNEL_ORDER.indexOf(stage);
  if (newIdx > currentIdx) {
    await client
      .from("conversation_sessions")
      .update({ funnel_stage: stage })
      .eq("id", existing.id);
  }
}
