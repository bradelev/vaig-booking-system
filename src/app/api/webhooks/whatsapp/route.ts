import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

// GET — webhook verification (Meta challenge)
export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature) return false;

  // Meta sends: sha256=<hex>
  const sigHeader = signature.startsWith("sha256=") ? signature.slice(7) : signature;

  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(sigHeader, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export type WhatsAppTextMessage = {
  type: "text";
  text: { body: string };
};

export type WhatsAppInteractiveMessage = {
  type: "interactive";
  interactive: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
};

export type WhatsAppMessage = (WhatsAppTextMessage | WhatsAppInteractiveMessage) & {
  id: string;
  from: string;
  timestamp: string;
};

export type WhatsAppWebhookPayload = {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
};

export function parseWebhookPayload(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "messages" && change.value.messages) {
        messages.push(...change.value.messages);
      }
    }
  }
  return messages;
}

async function processMessages(messages: WhatsAppMessage[]): Promise<void> {
  // Placeholder for state machine processing (VBS-20)
  // Each message will be routed through the bot state machine
  console.log(`[WA Webhook] Processing ${messages.length} message(s)`);
  for (const msg of messages) {
    console.log(`[WA Webhook] From: ${msg.from}, type: ${msg.type}`);
  }
}

// POST — incoming messages
export async function POST(request: NextRequest) {
  // Respond 200 immediately (Meta requires < 5s response)
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const messages = parseWebhookPayload(payload);

  // Use waitUntil if available (Vercel Edge), otherwise fire-and-forget
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (globalThis as any)[Symbol.for("next.request.context")];
  if (ctx?.waitUntil) {
    ctx.waitUntil(processMessages(messages));
  } else {
    void processMessages(messages);
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
