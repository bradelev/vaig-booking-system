// WhatsApp Business API client

export interface SendTextMessageParams {
  to: string; // phone number with country code, no +
  body: string;
}

export interface SendInteractiveButtonsParams {
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
}

const BASE_URL = "https://graph.facebook.com/v19.0";

function getPhoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");
  return id;
}

function getAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not set");
  return token;
}

async function sendMessage(body: Record<string, unknown>): Promise<void> {
  const phoneNumberId = getPhoneNumberId();
  const token = getAccessToken();

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${error}`);
  }
}

export async function sendTextMessage({ to, body }: SendTextMessageParams): Promise<void> {
  await sendMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body },
  });
}

export async function sendInteractiveButtons({
  to,
  body,
  buttons,
}: SendInteractiveButtonsParams): Promise<void> {
  await sendMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply",
          reply: { id: btn.id, title: btn.title },
        })),
      },
    },
  });
}

export async function sendListMessage({
  to,
  body,
  buttonText,
  sections,
}: {
  to: string;
  body: string;
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}): Promise<void> {
  await sendMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}
