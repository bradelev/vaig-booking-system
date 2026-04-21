import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { getSession, upsertSession, clearSession, advanceFunnel } from "../session";
import { createAdminClient } from "@/lib/supabase/admin";

function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };

  const client = {
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };

  vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
  return { client, chain };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSession", () => {
  it("returns null when no session found", async () => {
    makeSupabaseMock();
    const result = await getSession("598099999999");
    expect(result).toBeNull();
  });

  it("returns session object when data exists", async () => {
    const { chain } = makeSupabaseMock();
    chain.maybeSingle.mockResolvedValue({
      data: {
        id: "sess-1",
        phone: "598099999999",
        state: "menu",
        context_json: { serviceId: "s1" },
        last_message_at: "2026-04-20T10:00:00.000Z",
        updated_at: "2026-04-20T10:00:00.000Z",
        handoff_active: false,
        handoff_at: null,
        last_inbound_at: null,
      },
    });

    const result = await getSession("598099999999");
    expect(result).not.toBeNull();
    expect(result!.phone).toBe("598099999999");
    expect(result!.state).toBe("menu");
    expect(result!.context).toEqual({ serviceId: "s1" });
    expect(result!.handoffActive).toBe(false);
  });

  it("defaults state to idle when state is missing", async () => {
    const { chain } = makeSupabaseMock();
    chain.maybeSingle.mockResolvedValue({
      data: {
        id: "sess-2",
        phone: "598011111111",
        state: null,
        context_json: {},
        last_message_at: "2026-04-20T10:00:00.000Z",
        updated_at: null,
        handoff_active: null,
        handoff_at: null,
        last_inbound_at: null,
      },
    });

    const result = await getSession("598011111111");
    expect(result!.state).toBe("idle");
    expect(result!.handoffActive).toBe(false);
  });

  it("parses handoff_at as Date when present", async () => {
    const { chain } = makeSupabaseMock();
    chain.maybeSingle.mockResolvedValue({
      data: {
        id: "sess-3",
        phone: "598022222222",
        state: "idle",
        context_json: {},
        last_message_at: "2026-04-20T10:00:00.000Z",
        updated_at: "2026-04-20T10:00:00.000Z",
        handoff_active: true,
        handoff_at: "2026-04-20T09:00:00.000Z",
        last_inbound_at: "2026-04-20T09:30:00.000Z",
      },
    });

    const result = await getSession("598022222222");
    expect(result!.handoffActive).toBe(true);
    expect(result!.handoffAt).toBeInstanceOf(Date);
    expect(result!.lastInboundAt).toBeInstanceOf(Date);
  });
});

describe("upsertSession", () => {
  it("calls upsert with correct payload", async () => {
    const { chain } = makeSupabaseMock();

    await upsertSession("598099999999", "booking_service", { serviceId: "s1" });

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "598099999999", state: "booking_service", context_json: { serviceId: "s1" } }),
      { onConflict: "phone" }
    );
  });

  it("upserts with correct phone for new session", async () => {
    const { chain } = makeSupabaseMock();

    await upsertSession("598011111111", "idle", {});

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "598011111111", state: "idle" }),
      { onConflict: "phone" }
    );
  });
});

describe("clearSession", () => {
  it("calls delete on the correct phone", async () => {
    const { chain } = makeSupabaseMock();

    await clearSession("598099999999");

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("phone", "598099999999");
  });
});

describe("advanceFunnel", () => {
  it("does nothing when no session exists", async () => {
    const { chain } = makeSupabaseMock();
    chain.maybeSingle.mockResolvedValue({ data: null });

    await advanceFunnel("598099999999", "started");

    expect(chain.update).not.toHaveBeenCalled();
  });

  it("updates funnel stage when new stage is higher", async () => {
    const { chain } = makeSupabaseMock();
    chain.maybeSingle.mockResolvedValue({ data: { id: "sess-1", funnel_stage: "started" } });

    await advanceFunnel("598099999999", "service_selected");

    expect(chain.update).toHaveBeenCalledWith({ funnel_stage: "service_selected" });
  });

  it("does not update when new stage is lower or equal", async () => {
    const { chain } = makeSupabaseMock();
    chain.maybeSingle.mockResolvedValue({ data: { id: "sess-1", funnel_stage: "service_selected" } });

    await advanceFunnel("598099999999", "started");

    expect(chain.update).not.toHaveBeenCalled();
  });

  it("updates from data_completed to payment_done", async () => {
    const { chain } = makeSupabaseMock();
    chain.maybeSingle.mockResolvedValue({ data: { id: "sess-1", funnel_stage: "data_completed" } });

    await advanceFunnel("598099999999", "payment_done");

    expect(chain.update).toHaveBeenCalledWith({ funnel_stage: "payment_done" });
  });
});
