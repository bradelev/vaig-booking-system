/**
 * VBS-156: Human handoff — activate/release handoff for a phone number.
 * When handoff is active, the bot engine skips processing for that phone.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTextMessage } from "@/lib/whatsapp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const HANDOFF_KEYWORDS = [
  "hablar con persona",
  "hablar con alguien",
  "operador",
  "operadora",
  "humano",
  "agente",
  "persona real",
  "atencion humana",
  "hablar con un humano",
];

/** Check if the message text requests human handoff. */
export function isHandoffTrigger(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return HANDOFF_KEYWORDS.some((kw) => normalized.includes(kw));
}

/** Activate handoff for a phone — bot stops replying, admin takes over. */
export async function activateHandoff(phone: string): Promise<void> {
  const client = createAdminClient() as AnyClient;
  const now = new Date().toISOString();

  // Ensure session exists
  const { data: existing } = await client
    .from("conversation_sessions")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing?.id) {
    await client
      .from("conversation_sessions")
      .update({ handoff_active: true, handoff_at: now })
      .eq("id", existing.id);
  } else {
    await client.from("conversation_sessions").insert({
      phone,
      state: "idle",
      context_json: {},
      last_message_at: now,
      handoff_active: true,
      handoff_at: now,
    });
  }

  await sendTextMessage({
    to: phone,
    body: "Te paso con una persona de nuestro equipo. En breve te responden. 🙋",
  });
}

/** Release handoff — bot resumes handling messages for this phone. */
export async function releaseHandoff(phone: string): Promise<void> {
  const client = createAdminClient() as AnyClient;

  await client
    .from("conversation_sessions")
    .update({
      handoff_active: false,
      handoff_at: null,
      state: "idle",
      context_json: {},
    })
    .eq("phone", phone);

  await sendTextMessage({
    to: phone,
    body: "Nuestro equipo ya te atendió. Si necesitás algo más, escribí *hola*. 👋",
  });
}

/** Update last_inbound_at on the session (called from webhook). */
export async function updateLastInbound(phone: string): Promise<void> {
  const client = createAdminClient() as AnyClient;
  const now = new Date().toISOString();

  const { data: existing } = await client
    .from("conversation_sessions")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing?.id) {
    await client
      .from("conversation_sessions")
      .update({ last_inbound_at: now })
      .eq("id", existing.id);
  }
}
