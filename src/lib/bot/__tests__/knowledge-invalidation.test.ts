import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { buildKnowledgeBase, invalidateKnowledgeCache } from "../knowledge";
import { createAdminClient } from "@/lib/supabase/admin";

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
};

function makeSupabaseMock(
  servicesData: unknown[] = [],
  professionalsData: unknown[] = [],
  packagesData: unknown[] = [],
): MockChain {
  const chain: MockChain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };

  // Each call to chain returns itself until order() which resolves
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);

  let callCount = 0;
  chain.order.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve({ data: servicesData, error: null });
    if (callCount === 2) return Promise.resolve({ data: professionalsData, error: null });
    return Promise.resolve({ data: packagesData, error: null });
  });

  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  } as unknown as ReturnType<typeof createAdminClient>);

  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Always start with a clean cache
  invalidateKnowledgeCache();
});

describe("invalidateKnowledgeCache", () => {
  it("sets the cache to null so the next buildKnowledgeBase call fetches from DB", async () => {
    makeSupabaseMock();

    // Populate the cache
    await buildKnowledgeBase();
    expect(createAdminClient).toHaveBeenCalledTimes(1);

    // Invalidate — next call must hit the DB again
    invalidateKnowledgeCache();

    makeSupabaseMock();
    await buildKnowledgeBase();
    expect(createAdminClient).toHaveBeenCalledTimes(2);
  });

  it("returns fresh data after invalidation", async () => {
    const firstServices = [
      {
        id: "svc-1",
        name: "Depilación",
        description: null,
        duration_minutes: 30,
        price: 1000,
        deposit_amount: 200,
        default_professional_id: null,
        category: null,
      },
    ];

    makeSupabaseMock(firstServices);
    const first = await buildKnowledgeBase();
    expect(first.services).toHaveLength(1);
    expect(first.services[0].name).toBe("Depilación");

    invalidateKnowledgeCache();

    const secondServices = [
      ...firstServices,
      {
        id: "svc-2",
        name: "Masaje",
        description: null,
        duration_minutes: 60,
        price: 2000,
        deposit_amount: 400,
        default_professional_id: null,
        category: null,
      },
    ];

    makeSupabaseMock(secondServices);
    const second = await buildKnowledgeBase();
    expect(second.services).toHaveLength(2);
    expect(second.services[1].name).toBe("Masaje");
  });

  it("does not refetch from DB when cache is still valid", async () => {
    makeSupabaseMock();

    await buildKnowledgeBase();
    await buildKnowledgeBase();

    // createAdminClient should only be called once — second call uses cache
    expect(createAdminClient).toHaveBeenCalledTimes(1);
  });

  it("returns new generatedAt timestamp after invalidation and refetch", async () => {
    makeSupabaseMock();
    const first = await buildKnowledgeBase();

    invalidateKnowledgeCache();

    makeSupabaseMock();
    const second = await buildKnowledgeBase();

    expect(second.generatedAt.getTime()).toBeGreaterThanOrEqual(first.generatedAt.getTime());
  });
});
