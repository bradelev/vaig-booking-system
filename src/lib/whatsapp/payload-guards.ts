import type { WhatsAppMessage, WhatsAppStatusUpdate } from "@/app/api/webhooks/whatsapp/route";

type WhatsAppEntryChange = {
  field: string;
  value: {
    messaging_product: string;
    metadata: { display_phone_number: string; phone_number_id: string };
    messages?: WhatsAppMessage[];
    statuses?: WhatsAppStatusUpdate[];
  };
};

export type WhatsAppEntry = {
  id: string;
  changes: WhatsAppEntryChange[];
};

export function isValidWebhookEntry(entry: unknown): entry is WhatsAppEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return typeof e.id === "string" && Array.isArray(e.changes);
}

export function isValidMessage(msg: unknown): msg is WhatsAppMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    typeof m.id === "string" && m.id.length > 0 &&
    typeof m.from === "string" && m.from.length > 0 &&
    typeof m.type === "string" &&
    (typeof m.timestamp === "string" || typeof m.timestamp === "number")
  );
}

export function isValidStatusUpdate(status: unknown): status is WhatsAppStatusUpdate {
  if (typeof status !== "object" || status === null) return false;
  const s = status as Record<string, unknown>;
  return (
    typeof s.id === "string" && s.id.length > 0 &&
    typeof s.status === "string" &&
    (typeof s.timestamp === "string" || typeof s.timestamp === "number") &&
    typeof s.recipient_id === "string" && s.recipient_id.length > 0
  );
}
