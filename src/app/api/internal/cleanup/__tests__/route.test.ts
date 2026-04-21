import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/config", () => ({
  getConfigValue: vi.fn((_key: string, fallback: string) => Promise.resolve(fallback)),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- Helpers ---

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/internal/cleanup", { headers });
}

function buildChain(result: { data: { id: string }[] | null; error: null | { message: string } }) {
  const chain = {
    delete: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

// --- Tests ---

describe("GET /api/internal/cleanup", () => {
  const CRON_SECRET = "test-cron-secret";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("../route");
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header is wrong", async () => {
    const { GET } = await import("../route");
    const req = makeRequest("Bearer wrong-secret");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns cleanup counts on success", async () => {
    const sessionChain = buildChain({ data: [{ id: "s1" }, { id: "s2" }], error: null });
    const messageChain = buildChain({ data: [{ id: "m1" }], error: null });

    mockFrom
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(messageChain);

    const { GET } = await import("../route");
    const req = makeRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted.sessions).toBe(2);
    expect(body.deleted.messages).toBe(1);
    expect(body.retentionDays.sessions).toBe(30);
    expect(body.retentionDays.messages).toBe(90);
  });

  it("returns 500 when session delete fails", async () => {
    const sessionChain = buildChain({ data: null, error: { message: "DB error" } });
    mockFrom.mockReturnValueOnce(sessionChain);

    const { GET } = await import("../route");
    const req = makeRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB error");
  });

  it("returns 500 when message delete fails", async () => {
    const sessionChain = buildChain({ data: [], error: null });
    const messageChain = buildChain({ data: null, error: { message: "msg error" } });
    mockFrom
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(messageChain);

    const { GET } = await import("../route");
    const req = makeRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("msg error");
  });

  it("allows request when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;

    const sessionChain = buildChain({ data: [], error: null });
    const messageChain = buildChain({ data: [], error: null });
    mockFrom
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(messageChain);

    const { GET } = await import("../route");
    const req = makeRequest();
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted.sessions).toBe(0);
    expect(body.deleted.messages).toBe(0);
  });
});
