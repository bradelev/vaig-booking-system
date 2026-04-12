/**
 * Logged wrappers around the raw WhatsApp API client.
 * Each function logs the message to the `messages` table before and after sending.
 */
import {
  sendTextMessage as rawSendText,
  sendInteractiveButtons as rawSendButtons,
  sendTemplateMessage as rawSendTemplate,
  sendImageMessage as rawSendImage,
  sendListMessage as rawSendList,
  type SendTextMessageParams,
  type SendInteractiveButtonsParams,
  type SendTemplateMessageParams,
  type SendImageMessageParams,
} from "./index";
import {
  logOutboundMessage,
  markMessageSent,
  markMessageFailed,
  type MessageSource,
} from "./log";

export type { MessageSource };

export async function sendTextMessage(
  params: SendTextMessageParams,
  source: MessageSource
): Promise<string> {
  const rowId = await logOutboundMessage({
    phone: params.to,
    messageType: "text",
    body: params.body,
    source,
  });
  try {
    const waId = await rawSendText(params);
    await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function sendInteractiveButtons(
  params: SendInteractiveButtonsParams,
  source: MessageSource
): Promise<string> {
  const rowId = await logOutboundMessage({
    phone: params.to,
    messageType: "interactive",
    body: params.body,
    source,
  });
  try {
    const waId = await rawSendButtons(params);
    await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function sendTemplateMessage(
  params: SendTemplateMessageParams,
  source: MessageSource
): Promise<string> {
  const rowId = await logOutboundMessage({
    phone: params.to,
    messageType: "template",
    body: `[template: ${params.templateName}]`,
    source,
  });
  try {
    const waId = await rawSendTemplate(params);
    await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function sendImageMessage(
  params: SendImageMessageParams,
  source: MessageSource
): Promise<string> {
  const rowId = await logOutboundMessage({
    phone: params.to,
    messageType: "image",
    body: params.caption ?? null,
    source,
  });
  try {
    const waId = await rawSendImage(params);
    await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function sendListMessage(
  params: Parameters<typeof rawSendList>[0],
  source: MessageSource
): Promise<string> {
  const rowId = await logOutboundMessage({
    phone: params.to,
    messageType: "list",
    body: params.body,
    source,
  });
  try {
    const waId = await rawSendList(params);
    await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
