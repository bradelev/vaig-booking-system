/**
 * Logged wrappers around the raw WhatsApp API client.
 * Each function attempts to log the message to the `messages` table, but logging
 * failures are non-fatal — the WhatsApp send always proceeds.
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
import { logger } from "@/lib/logger";

export type { MessageSource };

export async function sendTextMessage(
  params: SendTextMessageParams,
  source: MessageSource
): Promise<string> {
  let rowId: string | null = null;
  try {
    rowId = await logOutboundMessage({
      phone: params.to,
      messageType: "text",
      body: params.body,
      source,
    });
  } catch (logErr) {
    logger.error("logOutboundMessage failed (non-fatal)", { error: logErr instanceof Error ? logErr.message : String(logErr) });
  }
  try {
    const waId = await rawSendText(params);
    if (rowId) await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    if (rowId) await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function sendInteractiveButtons(
  params: SendInteractiveButtonsParams,
  source: MessageSource
): Promise<string> {
  let rowId: string | null = null;
  try {
    rowId = await logOutboundMessage({
      phone: params.to,
      messageType: "interactive",
      body: params.body,
      source,
    });
  } catch (logErr) {
    logger.error("logOutboundMessage failed (non-fatal)", { error: logErr instanceof Error ? logErr.message : String(logErr) });
  }
  try {
    const waId = await rawSendButtons(params);
    if (rowId) await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    if (rowId) await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function sendTemplateMessage(
  params: SendTemplateMessageParams,
  source: MessageSource
): Promise<string> {
  let rowId: string | null = null;
  try {
    rowId = await logOutboundMessage({
      phone: params.to,
      messageType: "template",
      body: `[template: ${params.templateName}]`,
      source,
    });
  } catch (logErr) {
    logger.error("logOutboundMessage failed (non-fatal)", { error: logErr instanceof Error ? logErr.message : String(logErr) });
  }
  try {
    const waId = await rawSendTemplate(params);
    if (rowId) await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    if (rowId) await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function sendImageMessage(
  params: SendImageMessageParams,
  source: MessageSource
): Promise<string> {
  let rowId: string | null = null;
  try {
    rowId = await logOutboundMessage({
      phone: params.to,
      messageType: "image",
      body: params.caption ?? null,
      source,
    });
  } catch (logErr) {
    logger.error("logOutboundMessage failed (non-fatal)", { error: logErr instanceof Error ? logErr.message : String(logErr) });
  }
  try {
    const waId = await rawSendImage(params);
    if (rowId) await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    if (rowId) await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function sendListMessage(
  params: Parameters<typeof rawSendList>[0],
  source: MessageSource
): Promise<string> {
  let rowId: string | null = null;
  try {
    rowId = await logOutboundMessage({
      phone: params.to,
      messageType: "list",
      body: params.body,
      source,
    });
  } catch (logErr) {
    logger.error("logOutboundMessage failed (non-fatal)", { error: logErr instanceof Error ? logErr.message : String(logErr) });
  }
  try {
    const waId = await rawSendList(params);
    if (rowId) await markMessageSent(rowId, waId);
    return waId;
  } catch (err) {
    if (rowId) await markMessageFailed(rowId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
