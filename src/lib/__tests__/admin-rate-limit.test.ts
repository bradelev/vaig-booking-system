import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { checkAdminRateLimit } from "../admin-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

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
});

describe("checkAdminRateLimit", () => {
  it("allows first request (no existing row)", async () => {
    makeDbMock([]);
    const result = await checkAdminRateLimit("user-abc");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it("allows request when count is below limit", async () => {
    makeDbMock([{ id: "row-1", message_count: 30, window_start: new Date().toISOString() }]);
    const result = await checkAdminRateLimit("user-abc");
    expect(result.allowed).toBe(true);
  });

  it("blocks request when count equals max (60)", async () => {
    makeDbMock([{ id: "row-1", message_count: 60, window_start: new Date().toISOString() }]);
    const result = await checkAdminRateLimit("user-abc");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(60);
  });

  it("blocks request when count exceeds max", async () => {
    makeDbMock([{ id: "row-1", message_count: 99, window_start: new Date().toISOString() }]);
    const result = await checkAdminRateLimit("user-abc");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(60);
  });

  it("inserts a new row when no existing row is found", async () => {
    const chain = makeDbMock([]);
    await checkAdminRateLimit("user-abc");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "admin:user-abc", message_count: 1 })
    );
  });

  it("increments existing row when count is below limit", async () => {
    const chain = makeDbMock([{ id: "row-1", message_count: 5, window_start: new Date().toISOString() }]);
    await checkAdminRateLimit("user-abc");
    expect(chain.update).toHaveBeenCalledWith({ message_count: 6 });
  });

  it("uses admin: prefix to namespace the key away from bot entries", async () => {
    const chain = makeDbMock([]);
    await checkAdminRateLimit("user-xyz");
    expect(chain.eq).toHaveBeenCalledWith("phone", "admin:user-xyz");
  });

  it("window resets after 60s — treats old rows as expired (empty query result)", async () => {
    // Simulates that DB returns no rows because window_start is older than 60s ago
    makeDbMock([]);
    const result = await checkAdminRateLimit("user-abc");
    expect(result.allowed).toBe(true);
  });
});
