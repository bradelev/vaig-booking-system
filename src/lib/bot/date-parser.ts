/**
 * VBS-152 — Smart date/time parser for the booking bot.
 *
 * Two-tier approach:
 * 1. Enhanced regex: handles HH:MM, 5pm, 10hs, "a las 5", day names, dd/mm, "mañana", "hoy"
 *    Business heuristic: bare hours 1-8 without AM/PM marker → PM (beauty salon hours 9-21)
 * 2. LLM fallback (Claude Haiku): for complex natural language like "el próximo miércoles"
 *    Only called when regex returns null AND text looks temporal.
 */

import { artDateTime, getARTComponents } from "@/lib/timezone";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const TZ = "America/Argentina/Buenos_Aires";

export interface ParsedDateTime {
  date: Date;
  source: "regex" | "llm";
}

// Day name → weekday index (0=Sunday)
const DAY_MAP: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3,
  jueves: 4, viernes: 5, sabado: 6,
};

// Words that suggest a temporal expression when regex fails
const TEMPORAL_HINTS = [
  "proximo", "próximo", "siguiente", "semana", "mes",
  ...Object.keys(DAY_MAP),
  "hoy", "manana", "mañana", "pasado", "tarde", "noche",
];

/** Normalize text: lowercase, remove accents */
function norm(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Apply business hours heuristic:
 * Bare hours 1-8 (no am/pm context) → PM (add 12).
 * Hour 0 is ambiguous but left as 00:00 (midnight — won't appear in salon context).
 */
function applyBusinessHours(hour: number, hadExplicitAmPm: boolean, hadColon: boolean): number {
  if (hadExplicitAmPm || hadColon) return hour;
  if (hour >= 1 && hour <= 8) return hour + 12;
  return hour;
}

/**
 * Tier 1: Enhanced regex parser.
 * Extends the original parseUserDateTime with:
 * - 5pm / 3am
 * - 10hs / 5h / 5hrs
 * - "a las 5" / "a la 1"
 * - "hoy"
 * - Business hours heuristic for bare hours
 */
export function parseUserDateTimeRegex(text: string): Date | null {
  const t = norm(text);
  const now = new Date();
  const { dayOfWeek: currentArtDay } = getARTComponents(now);

  let hour: number | null = null;
  let minute = 0;
  let hadExplicitAmPm = false;
  let hadColon = false;

  // --- Time extraction ---

  // HH:MM (original)
  const colonMatch = t.match(/(\d{1,2}):(\d{2})/);
  if (colonMatch) {
    hour = parseInt(colonMatch[1]);
    minute = parseInt(colonMatch[2]);
    hadColon = true;
  }

  // 5pm / 10am (overrides colon match if more specific)
  const amPmMatch = t.match(/\b(\d{1,2})\s*(pm|am)\b/);
  if (amPmMatch) {
    const h = parseInt(amPmMatch[1]);
    const isPm = amPmMatch[2] === "pm";
    hour = isPm ? (h < 12 ? h + 12 : h) : (h === 12 ? 0 : h);
    minute = 0;
    hadExplicitAmPm = true;
    hadColon = false;
  }

  // 10hs / 5h / 5hrs
  const hsMatch = t.match(/\b(\d{1,2})\s*(hs|hrs|hr|h)\b/);
  if (hsMatch && !hadExplicitAmPm) {
    hour = parseInt(hsMatch[1]);
    minute = 0;
  }

  // "a las 5" / "a la 1" / "las 10"
  const alasMatch = t.match(/(?:a\s+las?\s+|^las?\s+)(\d{1,2})(?::(\d{2}))?\b/);
  if (alasMatch && !hadExplicitAmPm) {
    hour = parseInt(alasMatch[1]);
    minute = alasMatch[2] ? parseInt(alasMatch[2]) : 0;
    hadColon = !!alasMatch[2];
  }

  // Standalone hour number like "5 de la tarde" or just a number (last resort)
  if (hour === null) {
    const tardeNoche = t.includes("tarde") || t.includes("noche");
    const standaloneMatch = t.match(/\b(\d{1,2})\b/);
    if (standaloneMatch && tardeNoche) {
      hour = parseInt(standaloneMatch[1]);
    }
  }

  if (hour === null) return null;

  // Apply business hours heuristic
  hour = applyBusinessHours(hour, hadExplicitAmPm, hadColon);

  // Clamp to valid range
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  // --- Date extraction ---
  const candidate = new Date(now);

  if (t.includes("hoy")) {
    // today — use current date as-is
  } else if (t.includes("manana") || t.includes("mañana")) {
    candidate.setDate(now.getDate() + 1);
  } else if (t.includes("pasado")) {
    candidate.setDate(now.getDate() + 2);
  } else {
    let foundDay = false;
    for (const [name, dayNum] of Object.entries(DAY_MAP)) {
      if (t.includes(name)) {
        let daysAhead = (dayNum - currentArtDay + 7) % 7;
        if (daysAhead === 0) daysAhead = 7; // same weekday → next week
        candidate.setDate(now.getDate() + daysAhead);
        foundDay = true;
        break;
      }
    }

    if (!foundDay) {
      // dd/mm pattern
      const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        candidate.setMonth(month, day);
        if (candidate < now) candidate.setFullYear(now.getFullYear() + 1);
      }
    }
  }

  return artDateTime(candidate, hour, minute);
}

/** Returns true if the text is likely to contain a temporal expression */
function looksTemporalButRegexFailed(text: string): boolean {
  const t = norm(text);
  return TEMPORAL_HINTS.some((hint) => t.includes(hint)) || /\d/.test(t);
}

/**
 * Tier 2: LLM-based date parser for complex/ambiguous natural language.
 * Only called when Tier 1 returns null and the text looks temporal.
 */
async function parseWithLLM(text: string): Promise<Date | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const now = new Date();
  const { dayOfWeek } = getARTComponents(now);
  const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const todayStr = now.toLocaleDateString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

  const prompt = `Hoy es ${dayNames[dayOfWeek]} ${todayStr} (hora Argentina, UTC-3).
El centro de belleza tiene horarios de 9:00 a 21:00.
Regla: si el usuario dice una hora sin AM/PM y es entre 1 y 8, asumí PM (ej: "las 5" → 17:00, "a las 3" → 15:00).

Parseá esta fecha/hora en el mensaje de usuario. Respondé SOLO con JSON o null.
Formato: { "date": "YYYY-MM-DD", "hour": HH, "minute": MM }

Mensaje: "${text.replace(/"/g, "'")}"`;

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
        max_tokens: 80,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const raw = data.content.find((c) => c.type === "text")?.text?.trim() ?? "";

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[^}]+\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { date?: string; hour?: number; minute?: number };
    if (!parsed.date || parsed.hour === undefined) return null;

    const [year, month, day] = parsed.date.split("-").map(Number);
    const candidate = new Date(year, month - 1, day);
    return artDateTime(candidate, parsed.hour, parsed.minute ?? 0);
  } catch {
    return null;
  }
}

/**
 * Main entry point. Tries regex first, then LLM if needed.
 * Returns null if date/time cannot be determined.
 */
export async function parseSmartDateTime(text: string): Promise<ParsedDateTime | null> {
  // Tier 1: enhanced regex
  const regexResult = parseUserDateTimeRegex(text);
  if (regexResult) {
    return { date: regexResult, source: "regex" };
  }

  // Tier 2: LLM fallback
  if (looksTemporalButRegexFailed(text)) {
    const llmResult = await parseWithLLM(text);
    if (llmResult) {
      return { date: llmResult, source: "llm" };
    }
  }

  return null;
}
