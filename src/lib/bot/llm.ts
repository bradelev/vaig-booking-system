/**
 * VBS-31 — LLM query handler using Claude API.
 * Answers free-form user questions about services, prices, professionals, etc.
 * Uses the knowledge base as grounding context.
 */
import { buildKnowledgeBase, formatKnowledgeForLLM } from "./knowledge";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 512;

const SYSTEM_PROMPT = `Sos el asistente virtual de VAIG, un centro de bienestar y belleza.
Tu rol es responder preguntas sobre los servicios, precios, profesionales y horarios.
Respondé siempre en español, de forma amigable y concisa (máximo 3 párrafos cortos).
Usá la información del contexto. Si no sabés algo, decí que no tenés esa información
y sugierí escribir "hola" para hablar con el equipo.
NO inventes precios, horarios ni información que no esté en el contexto.
NO hables de temas ajenos al negocio.`;

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return key;
}

export async function answerWithLLM(userMessage: string): Promise<string> {
  const knowledge = await buildKnowledgeBase();
  const context = formatKnowledgeForLLM(knowledge);

  const userContent = `Contexto del negocio:\n${context}\n\nPregunta del cliente:\n${userMessage}`;

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  return text.trim();
}
