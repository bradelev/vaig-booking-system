import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { parseWebhookPayload } from "../route";
import type { WhatsAppWebhookPayload } from "../route";
import { isValidMessage, isValidStatusUpdate, isValidWebhookEntry } from "@/lib/whatsapp/payload-guards";

function makePayload(messages?: WhatsAppWebhookPayload["entry"][0]["changes"][0]["value"]["messages"]): WhatsAppWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "1234567890", phone_number_id: "phone-1" },
              ...(messages ? { messages } : {}),
            },
          },
        ],
      },
    ],
  };
}

describe("parseWebhookPayload", () => {
  it("returns text message from payload", () => {
    const payload = makePayload([
      { id: "msg-1", from: "5491100001111", timestamp: "1700000000", type: "text", text: { body: "Hola" } },
    ]);
    const { messages: result } = parseWebhookPayload(payload);
    expect(result.length).toBe(1);
    expect(result[0].from).toBe("5491100001111");
    expect(result[0].type).toBe("text");
    if (result[0].type === "text") {
      expect(result[0].text.body).toBe("Hola");
    }
  });

  it("returns interactive button_reply message", () => {
    const payload = makePayload([
      {
        id: "msg-2",
        from: "5491100002222",
        timestamp: "1700000001",
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: { id: "book", title: "Agendar turno" },
        },
      },
    ]);
    const { messages: result } = parseWebhookPayload(payload);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("interactive");
    if (result[0].type === "interactive") {
      expect(result[0].interactive.type).toBe("button_reply");
      expect(result[0].interactive.button_reply?.id).toBe("book");
    }
  });

  it("returns interactive list_reply message", () => {
    const payload = makePayload([
      {
        id: "msg-3",
        from: "5491100003333",
        timestamp: "1700000002",
        type: "interactive",
        interactive: {
          type: "list_reply",
          list_reply: { id: "slot_1", title: "Lunes 09:00" },
        },
      },
    ]);
    const { messages: result } = parseWebhookPayload(payload);
    expect(result.length).toBe(1);
    if (result[0].type === "interactive") {
      expect(result[0].interactive.type).toBe("list_reply");
      expect(result[0].interactive.list_reply?.id).toBe("slot_1");
    }
  });

  it("returns empty array when payload has no messages (status update)", () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "1234567890", phone_number_id: "phone-1" },
                statuses: [
                  { id: "msg-1", status: "delivered", timestamp: "1700000000", recipient_id: "5491100001111" },
                ],
              },
            },
          ],
        },
      ],
    };
    const { messages: result } = parseWebhookPayload(payload);
    expect(result.length).toBe(0);
  });

  it("returns empty array when entry list is empty", () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [],
    };
    const { messages: result } = parseWebhookPayload(payload);
    expect(result.length).toBe(0);
  });

  it("returns messages from multiple entries", () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "1234567890", phone_number_id: "phone-1" },
                messages: [
                  { id: "msg-1", from: "111", timestamp: "1700000000", type: "text", text: { body: "A" } },
                ],
              },
            },
          ],
        },
        {
          id: "entry-2",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "1234567890", phone_number_id: "phone-2" },
                messages: [
                  { id: "msg-2", from: "222", timestamp: "1700000001", type: "text", text: { body: "B" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const { messages: result } = parseWebhookPayload(payload);
    expect(result.length).toBe(2);
  });

  it("propagates errors[] from a failed status update", () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "1234567890", phone_number_id: "phone-1" },
                statuses: [
                  {
                    id: "wamid.abc123",
                    status: "failed",
                    timestamp: "1700000005",
                    recipient_id: "59898626616",
                    errors: [
                      {
                        code: 131026,
                        title: "Message undeliverable",
                        message: "Number is not on WhatsApp",
                        error_data: { details: "Not a valid WA number" },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const { statuses } = parseWebhookPayload(payload);
    expect(statuses.length).toBe(1);
    expect(statuses[0].status).toBe("failed");
    expect(statuses[0].errors).toHaveLength(1);
    expect(statuses[0].errors![0].code).toBe(131026);
    expect(statuses[0].errors![0].error_data?.details).toBe("Not a valid WA number");
  });

  it("ignores changes with field other than 'messages'", () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "account_alerts",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "1234567890", phone_number_id: "phone-1" },
                messages: [
                  { id: "msg-1", from: "111", timestamp: "1700000000", type: "text", text: { body: "X" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const { messages: result } = parseWebhookPayload(payload);
    expect(result.length).toBe(0);
  });
});

describe("isValidMessage", () => {
  it("returns true for a valid text message", () => {
    expect(isValidMessage({ id: "msg-1", from: "5491100001111", timestamp: "1700000000", type: "text", text: { body: "Hi" } })).toBe(true);
  });

  it("returns false when id is missing", () => {
    expect(isValidMessage({ from: "5491100001111", timestamp: "1700000000", type: "text" })).toBe(false);
  });

  it("returns false when id is an empty string", () => {
    expect(isValidMessage({ id: "", from: "5491100001111", timestamp: "1700000000", type: "text" })).toBe(false);
  });

  it("returns false when from is missing", () => {
    expect(isValidMessage({ id: "msg-1", timestamp: "1700000000", type: "text" })).toBe(false);
  });

  it("returns false when from is an empty string", () => {
    expect(isValidMessage({ id: "msg-1", from: "", timestamp: "1700000000", type: "text" })).toBe(false);
  });

  it("returns false when type is missing", () => {
    expect(isValidMessage({ id: "msg-1", from: "5491100001111", timestamp: "1700000000" })).toBe(false);
  });

  it("returns false when timestamp is missing", () => {
    expect(isValidMessage({ id: "msg-1", from: "5491100001111", type: "text" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidMessage(null)).toBe(false);
  });

  it("returns false for a primitive", () => {
    expect(isValidMessage("not-an-object")).toBe(false);
  });
});

describe("isValidStatusUpdate", () => {
  it("returns true for a valid status update", () => {
    expect(isValidStatusUpdate({ id: "wamid-1", status: "delivered", timestamp: "1700000000", recipient_id: "5491100001111" })).toBe(true);
  });

  it("returns false when id is missing", () => {
    expect(isValidStatusUpdate({ status: "delivered", timestamp: "1700000000", recipient_id: "5491100001111" })).toBe(false);
  });

  it("returns false when recipient_id is missing", () => {
    expect(isValidStatusUpdate({ id: "wamid-1", status: "delivered", timestamp: "1700000000" })).toBe(false);
  });

  it("returns false when recipient_id is empty", () => {
    expect(isValidStatusUpdate({ id: "wamid-1", status: "delivered", timestamp: "1700000000", recipient_id: "" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidStatusUpdate(null)).toBe(false);
  });
});

describe("isValidWebhookEntry", () => {
  it("returns true for a valid entry", () => {
    expect(isValidWebhookEntry({ id: "entry-1", changes: [] })).toBe(true);
  });

  it("returns false when id is missing", () => {
    expect(isValidWebhookEntry({ changes: [] })).toBe(false);
  });

  it("returns false when changes is not an array", () => {
    expect(isValidWebhookEntry({ id: "entry-1", changes: "nope" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidWebhookEntry(null)).toBe(false);
  });
});

describe("parseWebhookPayload — guard integration", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("drops a message missing id and logs a warning", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "1234567890", phone_number_id: "phone-1" },
                messages: [
                  { id: "msg-ok", from: "111", timestamp: "1700000000", type: "text", text: { body: "Good" } },
                  // Cast so TS lets us pass a malformed object to test the guard
                  { from: "222", timestamp: "1700000001", type: "text", text: { body: "Bad" } } as unknown as WhatsAppWebhookPayload["entry"][0]["changes"][0]["value"]["messages"] extends (infer T)[] ? T : never,
                ],
              },
            },
          ],
        },
      ],
    };
    const { messages } = parseWebhookPayload(payload);
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe("msg-ok");
    const warnArg = warnSpy.mock.calls.map((c) => c.join(" ")).find((s) => s.includes("dropped malformed message"));
    expect(warnArg).toBeDefined();
  });

  it("drops a status update missing recipient_id and logs a warning", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "1234567890", phone_number_id: "phone-1" },
                statuses: [
                  { id: "wamid-ok", status: "delivered", timestamp: "1700000000", recipient_id: "5491100001111" },
                  { id: "wamid-bad", status: "delivered", timestamp: "1700000001", recipient_id: "" } as unknown as WhatsAppWebhookPayload["entry"][0]["changes"][0]["value"]["statuses"] extends (infer T)[] | undefined ? T : never,
                ],
              },
            },
          ],
        },
      ],
    };
    const { statuses } = parseWebhookPayload(payload);
    expect(statuses.length).toBe(1);
    expect(statuses[0].id).toBe("wamid-ok");
    const warnArg = warnSpy.mock.calls.map((c) => c.join(" ")).find((s) => s.includes("dropped malformed status"));
    expect(warnArg).toBeDefined();
  });
});
