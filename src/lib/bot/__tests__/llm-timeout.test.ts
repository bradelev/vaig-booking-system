import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { KnowledgeBase } from "../types";

vi.mock("../knowledge", () => ({
  buildKnowledgeBase: vi.fn().mockResolvedValue({
    services: [{ id: "s1", name: "Depilación láser", category: "depilacion", durationMinutes: 60, price: 1000, description: null, depositAmount: 0, defaultProfessionalId: null }],
    professionals: [{ id: "p1", name: "Cynthia", specialties: null }],
    packages: [],
    generatedAt: new Date("2026-04-20T12:00:00.000Z"),
  } satisfies KnowledgeBase),
  formatKnowledgeForLLM: vi.fn().mockReturnValue("knowledge context"),
}));

const KB: KnowledgeBase = {
  services: [
    { id: "s1", name: "Depilación láser", category: "depilacion", durationMinutes: 60, price: 1000, description: null, depositAmount: 0, defaultProfessionalId: null },
  ],
  professionals: [{ id: "p1", name: "Cynthia", specialties: null }],
  packages: [],
  generatedAt: new Date("2026-04-20T12:00:00.000Z"),
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ANTHROPIC_API_KEY;
});

function makeHangingFetch() {
  return vi.fn().mockImplementation(
    (_url: string, opts: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = opts.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener("abort", () =>
            reject(Object.assign(new Error("AbortError"), { name: "AbortError" }))
          );
        }
      })
  );
}

describe("answerWithLLM — timeout", () => {
  it("throws LLM_TIMEOUT when fetch is aborted", async () => {
    const { answerWithLLM } = await import("../llm");

    // Simulate an already-aborted signal by rejecting with AbortError immediately
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
      Object.assign(new Error("AbortError"), { name: "AbortError" })
    ));

    await expect(answerWithLLM("¿cuánto cuesta la depilación?")).rejects.toThrow("LLM_TIMEOUT");
  });

  it("resolves normally when API responds within timeout", async () => {
    const { answerWithLLM } = await import("../llm");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "La depilación láser cuesta $1000." }],
      }),
    }));

    const result = await answerWithLLM("¿cuánto cuesta la depilación?");
    expect(result).toBe("La depilación láser cuesta $1000.");
  });
});

describe("detectIntent — timeout", () => {
  it("returns null when fetch is aborted", async () => {
    const { detectIntent } = await import("../intent");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
      Object.assign(new Error("AbortError"), { name: "AbortError" })
    ));

    const result = await detectIntent("quiero reservar mañana", KB);
    expect(result).toBeNull();
  });
});

describe("parseSmartDateTime — LLM timeout fallback", () => {
  it("returns null (not throwing) when LLM fetch is aborted", async () => {
    const { parseSmartDateTime } = await import("../date-parser");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
      Object.assign(new Error("AbortError"), { name: "AbortError" })
    ));

    const result = await parseSmartDateTime("el próximo miércoles");
    expect(result).toBeNull();
  });
});
