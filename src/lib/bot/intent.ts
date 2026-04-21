/**
 * VBS-153 — LLM-based intent detection for the booking bot.
 *
 * Called only for idle/menu states to understand natural language requests
 * before routing. Skipped for deep states where input is predictable (numbers, si/no).
 *
 * Uses Claude Haiku with a minimal JSON-only prompt.
 * max_tokens: 200 — intent JSON is always under 150 tokens.
 */

import { getARTComponents, LOCAL_TIMEZONE } from "@/lib/timezone";
import { logger } from "@/lib/logger";
import type { KnowledgeBase } from "./types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const TZ = LOCAL_TIMEZONE;

export type IntentType =
  | "book"
  | "cancel"
  | "reschedule"
  | "info"
  | "pack"
  | "greeting"
  | "thanks"
  | "question"
  | "confirm"
  | "deny"
  | "my_bookings"
  | "unknown";

export interface DetectedIntent {
  intent: IntentType;
  entities: {
    service?: string;
    date?: string;
    time?: string;
    professional?: string;
    timeWindow?: "mañana" | "tarde" | "noche";
  };
  confidence: number; // 0-1
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Detects the user's intent from a natural language message.
 * Only call from idle/menu states — not mid-flow.
 *
 * @param text           - Raw user message
 * @param kb             - Knowledge base with services and professionals
 * @param campaignContext - Optional: recent campaign sent to this user (name + body)
 * @returns DetectedIntent or null if API unavailable/parse failure
 */
export async function detectIntent(
  text: string,
  kb: KnowledgeBase,
  campaignContext?: { name: string; body: string } | null
): Promise<DetectedIntent | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const now = new Date();
  const { dayOfWeek } = getARTComponents(now);
  const todayStr = now.toLocaleDateString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const serviceNames = kb.services.map((s) => s.name).join(", ");
  const professionalNames = kb.professionals.map((p) => p.name).join(", ");

  const campaignLine = campaignContext
    ? `\nEl usuario recibió recientemente la campaña: "${campaignContext.name}" — ${campaignContext.body.slice(0, 120)}${campaignContext.body.length > 120 ? "..." : ""}. Tené esto en cuenta al interpretar su intención.`
    : "";

  const prompt = `Hoy es ${DAY_NAMES[dayOfWeek]} ${todayStr} (Argentina, UTC-3). El centro de belleza abre de 9 a 21.
Servicios disponibles: ${serviceNames}
Profesionales: ${professionalNames}${campaignLine}

Reglas de hora: si el usuario dice una hora sin AM/PM entre 1 y 8, es PM (ej: "las 5"→17:00, "a las 3"→15:00, "10hs"→10:00).
Hora "mañana/tarde/noche": mañana=9-12, tarde=12-19, noche=19-21.

Analizá este mensaje y respondé SOLO con JSON (sin texto adicional):
{
  "intent": "<intención>",
  "entities": { "service": "<nombre exacto o null>", "date": "<fecha normalizada o null>", "time": "<HH:MM 24h o null>", "professional": "<nombre o null>", "timeWindow": "<mañana|tarde|noche o null>" },
  "confidence": <0.0-1.0>
}

Intenciones válidas: book, cancel, reschedule, info, pack, greeting, thanks, question, confirm, deny, my_bookings, unknown.
Para "date" usá: "hoy", "mañana", "pasado", nombre de día ("lunes", "martes"...) o "DD/MM".
Para "time" usá formato 24h: "15:00", "10:30". Si no hay hora explícita, null.

Mensaje: "${text.replace(/"/g, "'")}"`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const raw = data.content.find((c) => c.type === "text")?.text?.trim() ?? "";

    // Extract JSON — LLM sometimes wraps in markdown code block
    const jsonMatch = raw.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<DetectedIntent>;

    // Validate required fields
    if (!parsed.intent || typeof parsed.confidence !== "number") return null;

    const validIntents: IntentType[] = [
      "book", "cancel", "reschedule", "info", "pack",
      "greeting", "thanks", "question", "confirm", "deny",
      "my_bookings", "unknown",
    ];
    if (!validIntents.includes(parsed.intent as IntentType)) return null;

    return {
      intent: parsed.intent as IntentType,
      entities: {
        service: parsed.entities?.service ?? undefined,
        date: parsed.entities?.date ?? undefined,
        time: parsed.entities?.time ?? undefined,
        professional: parsed.entities?.professional ?? undefined,
        timeWindow: parsed.entities?.timeWindow ?? undefined,
      },
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.error("Intent LLM request timed out", { timeout_ms: 8000 });
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
