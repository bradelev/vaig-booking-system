import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/whatsapp/logged", () => ({
  sendTextMessage: vi.fn().mockResolvedValue(undefined),
}));

import { isHandoffTrigger, activateHandoff, releaseHandoff, updateLastInbound } from "../handoff";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTextMessage } from "@/lib/whatsapp/logged";

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    update: vi.fn(),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  Object.assign(chain, overrides);
  return chain;
}

describe("isHandoffTrigger", () => {
  it("returns true for 'hablar con persona'", () => {
    expect(isHandoffTrigger("hablar con persona")).toBe(true);
  });

  it("returns true for 'operador'", () => {
    expect(isHandoffTrigger("operador")).toBe(true);
  });

  it("returns true for 'operadora'", () => {
    expect(isHandoffTrigger("operadora")).toBe(true);
  });

  it("returns true for 'humano'", () => {
    expect(isHandoffTrigger("quiero hablar con un humano")).toBe(true);
  });

  it("returns true for 'agente'", () => {
    expect(isHandoffTrigger("necesito un agente")).toBe(true);
  });

  it("returns true for 'persona real'", () => {
    expect(isHandoffTrigger("quiero hablar con una persona real")).toBe(true);
  });

  it("returns true for 'atencion humana' (with accent)", () => {
    expect(isHandoffTrigger("necesito atención humana")).toBe(true);
  });

  it("returns false for regular booking message", () => {
    expect(isHandoffTrigger("quiero reservar un turno")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isHandoffTrigger("")).toBe(false);
  });

  it("returns false for 'hola'", () => {
    expect(isHandoffTrigger("hola")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isHandoffTrigger("HABLAR CON PERSONA")).toBe(true);
    expect(isHandoffTrigger("Operador")).toBe(true);
  });

  it("handles accented characters", () => {
    expect(isHandoffTrigger("atención humana")).toBe(true);
  });
});

describe("activateHandoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates existing session when session exists", async () => {
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "session-1" } }),
    });
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue({ ...chain, eq: vi.fn().mockResolvedValue({ error: null }) });

    const mockClient = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

    await activateHandoff("59899000001");

    expect(mockClient.from).toHaveBeenCalledWith("conversation_sessions");
    expect(sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "59899000001" }),
      "bot"
    );
  });

  it("inserts new session when no session exists", async () => {
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockResolvedValue({ error: null });

    const mockClient = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

    await activateHandoff("59899000002");

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "59899000002", handoff_active: true })
    );
    expect(sendTextMessage).toHaveBeenCalled();
  });
});

describe("releaseHandoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates session to release handoff and sends message", async () => {
    const chain = makeChain();
    chain.update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const mockClient = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

    await releaseHandoff("59899000003");

    expect(mockClient.from).toHaveBeenCalledWith("conversation_sessions");
    expect(sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "59899000003" }),
      "bot"
    );
  });
});

describe("updateLastInbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates last_inbound_at when session exists", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const updateChain = { eq: updateEq };
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "session-1" } }),
    });
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(updateChain);

    const mockClient = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

    await updateLastInbound("59899000004");

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_inbound_at: expect.any(String) })
    );
  });

  it("does nothing when no session exists", async () => {
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);

    const mockClient = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createAdminClient).mockReturnValue(mockClient as never);

    await updateLastInbound("59899000005");

    expect(chain.update).not.toHaveBeenCalled();
  });
});
