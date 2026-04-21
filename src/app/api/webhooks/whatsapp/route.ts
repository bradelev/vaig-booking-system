import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logInboundMessage, updateMessageStatus } from "@/lib/whatsapp/log";
import { formatWebhookError } from "@/lib/whatsapp/meta-errors";
import { reconcileCampaignRecipientFromMessage } from "@/lib/campaigns/reconcile";

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
          errors?: Array<{ code: number; title?: string; message?: string; error_data?: { details?: string } }>;
        }>;
      };
      field: string;
    }>;
  }>;
};

export type WhatsAppStatusUpdate = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title?: string; message?: string; error_data?: { details?: string } }>;
};

export function parseWebhookPayload(payload: WhatsAppWebhookPayload): {
  messages: WhatsAppMessage[];
  statuses: WhatsAppStatusUpdate[];
} {
  const messages: WhatsAppMessage[] = [];
  const statuses: WhatsAppStatusUpdate[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "messages") {
        if (change.value.messages) messages.push(...change.value.messages);
        if (change.value.statuses) statuses.push(...change.value.statuses);
      }
    }
  }
  return { messages, statuses };
}

async function processMessages(messages: WhatsAppMessage[]): Promise<void> {
  const { handleIncomingMessage } = await import("@/lib/bot/engine");

  for (const msg of messages) {
    let text = "";
    const msgType = msg.type === "text" ? "text" : "interactive";

    if (msg.type === "text") {
      text = msg.text.body;
    } else if (msg.type === "interactive") {
      if (msg.interactive.type === "button_reply" && msg.interactive.button_reply) {
        text = msg.interactive.button_reply.id;
      } else if (msg.interactive.type === "list_reply" && msg.interactive.list_reply) {
        text = msg.interactive.list_reply.id;
      }
    }

    if (!text) continue;

    // Log inbound message before bot processing
    try {
      await logInboundMessage({
        phone: msg.from,
        waMessageId: msg.id,
        messageType: msgType,
        body: text,
      });
    } catch (err) {
      console.error(`[WA Webhook] Failed to log inbound message:`, err);
    }

    try {
      await handleIncomingMessage(msg.from, text);
    } catch (err) {
      console.error(`[WA Webhook] Error processing message from ${msg.from}:`, err);
    }
  }
}

async function processStatuses(statuses: WhatsAppStatusUpdate[]): Promise<void> {
  for (const s of statuses) {
    try {
      const { errorCode, errorMessage } = s.status === "failed"
        ? formatWebhookError(s.errors)
        : { errorCode: null, errorMessage: null };

      const row = await updateMessageStatus(s.id, s.status, errorCode, errorMessage);

      if (row) {
        await reconcileCampaignRecipientFromMessage(row, s.status, errorCode, errorMessage);
      }
    } catch (err) {
      console.error(`[WA Webhook] Failed to update status for ${s.id}:`, err);
    }
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

  const { messages, statuses } = parseWebhookPayload(payload);

  await Promise.all([
    processMessages(messages),
    processStatuses(statuses),
  ]);

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
