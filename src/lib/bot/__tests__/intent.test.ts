import { describe, it, expect, vi, afterEach } from "vitest";
import { detectIntent } from "../intent";
import type { KnowledgeBase } from "../types";

const KB: KnowledgeBase = {
  services: [
    { id: "s1", name: "Depilación láser", category: "depilacion", durationMinutes: 60, price: 1000 },
    { id: "s2", name: "Masaje relajante", category: "masajes", durationMinutes: 90, price: 1500 },
  ],
  professionals: [
    { id: "p1", name: "Cynthia", serviceIds: ["s1", "s2"] },
    { id: "p2", name: "Lucia", serviceIds: ["s1"] },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("detectIntent — no API key", () => {
  it("returns null when ANTHROPIC_API_KEY is not set", async () => {
    const orig = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const result = await detectIntent("quiero reservar", KB);
    expect(result).toBeNull();
    if (orig) process.env.ANTHROPIC_API_KEY = orig;
  });
});

describe("detectIntent — fetch mocking", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns parsed intent when API responds correctly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"intent":"book","entities":{"service":"Depilación láser","date":"mañana","time":"15:00","professional":null,"timeWindow":null},"confidence":0.95}' }],
      }),
    }));

    const result = await detectIntent("quiero depilarme mañana a las 3", KB);
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("book");
    expect(result!.confidence).toBe(0.95);
    expect(result!.entities.service).toBe("Depilación láser");
    expect(result!.entities.time).toBe("15:00");
  });

  it("returns null when API returns non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const result = await detectIntent("quiero reservar", KB);
    expect(result).toBeNull();
  });

  it("returns null when response JSON has no text content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    }));

    const result = await detectIntent("quiero reservar", KB);
    expect(result).toBeNull();
  });

  it("returns null when LLM returns invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Lo siento, no entendí" }],
      }),
    }));

    const result = await detectIntent("quiero reservar", KB);
    expect(result).toBeNull();
  });

  it("returns null when intent field is invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"intent":"invalid_intent","entities":{},"confidence":0.9}' }],
      }),
    }));

    const result = await detectIntent("quiero reservar", KB);
    expect(result).toBeNull();
  });

  it("clamps confidence to [0, 1]", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"intent":"greeting","entities":{},"confidence":1.5}' }],
      }),
    }));

    const result = await detectIntent("hola", KB);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(1);
  });

  it("handles JSON wrapped in markdown code block", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '```json\n{"intent":"cancel","entities":{},"confidence":0.8}\n```' }],
      }),
    }));

    const result = await detectIntent("cancelar mi turno", KB);
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("cancel");
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await detectIntent("quiero reservar", KB);
    expect(result).toBeNull();
  });

  it("includes campaign context in prompt when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"intent":"book","entities":{},"confidence":0.9}' }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await detectIntent("quiero aprovechar la promo", KB, { name: "Promo Otoño", body: "50% de descuento en depilación" });

    const callBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.messages[0].content).toContain("Promo Otoño");
  });
});
