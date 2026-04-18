import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { getRecentCampaignForPhone } from "../campaign-context";
import { createAdminClient } from "@/lib/supabase/admin";

function makeDbMock(returnValue: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(returnValue),
  };

  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  } as unknown as ReturnType<typeof createAdminClient>);

  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRecentCampaignForPhone", () => {
  it("returns null when no campaign found", async () => {
    makeDbMock({ data: null, error: null });
    const result = await getRecentCampaignForPhone("598099999999");
    expect(result).toBeNull();
  });

  it("returns campaign data when found", async () => {
    makeDbMock({
      data: {
        sent_at: "2026-04-20T08:00:00.000Z",
        campaigns: { name: "Promo Otoño", body: "50% de descuento" },
        clients: { phone: "598099999999" },
      },
      error: null,
    });

    const result = await getRecentCampaignForPhone("598099999999");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Promo Otoño");
    expect(result!.body).toBe("50% de descuento");
    expect(result!.sentAt).toBe("2026-04-20T08:00:00.000Z");
  });

  it("returns null when DB error occurs", async () => {
    makeDbMock({ data: null, error: new Error("DB error") });
    const result = await getRecentCampaignForPhone("598099999999");
    expect(result).toBeNull();
  });

  it("returns null when campaign has no name", async () => {
    makeDbMock({
      data: {
        sent_at: "2026-04-20T08:00:00.000Z",
        campaigns: { name: null, body: "body" },
        clients: { phone: "598099999999" },
      },
      error: null,
    });

    const result = await getRecentCampaignForPhone("598099999999");
    expect(result).toBeNull();
  });

  it("defaults body to empty string when missing", async () => {
    makeDbMock({
      data: {
        sent_at: "2026-04-20T08:00:00.000Z",
        campaigns: { name: "Campaign", body: null },
        clients: { phone: "598099999999" },
      },
      error: null,
    });

    const result = await getRecentCampaignForPhone("598099999999");
    expect(result!.body).toBe("");
  });

  it("returns null silently when createAdminClient throws", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Connection failed");
    });

    const result = await getRecentCampaignForPhone("598099999999");
    expect(result).toBeNull();
  });
});
