import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  getConfigValue: vi.fn().mockResolvedValue("30"), // default max messages
}));

import { checkRateLimit } from "../rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigValue } from "@/lib/config";

function makeDbMock(rows: unknown[] = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };

  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  } as unknown as ReturnType<typeof createAdminClient>);

  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConfigValue).mockResolvedValue("30");
});

describe("checkRateLimit", () => {
  it("allows first message (no existing row)", async () => {
    makeDbMock([]);
    const result = await checkRateLimit("598099999999");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it("allows message when count is below limit", async () => {
    makeDbMock([{ id: "row-1", message_count: 10, window_start: new Date().toISOString() }]);
    const result = await checkRateLimit("598099999999");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(19);
  });

  it("blocks message when count equals max", async () => {
    makeDbMock([{ id: "row-1", message_count: 30, window_start: new Date().toISOString() }]);
    const result = await checkRateLimit("598099999999");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("blocks message when count exceeds max", async () => {
    makeDbMock([{ id: "row-1", message_count: 50, window_start: new Date().toISOString() }]);
    const result = await checkRateLimit("598099999999");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("uses config values for window and max messages", async () => {
    vi.mocked(getConfigValue)
      .mockResolvedValueOnce("120") // window_minutes
      .mockResolvedValueOnce("10");  // max_messages

    makeDbMock([{ id: "row-1", message_count: 9, window_start: new Date().toISOString() }]);
    const result = await checkRateLimit("598099999999");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0); // 10 - 9 - 1 = 0
  });
});
