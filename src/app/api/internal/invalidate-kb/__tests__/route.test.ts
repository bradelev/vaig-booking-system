import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockInvalidateKnowledgeCache = vi.fn();

vi.mock("@/lib/bot/knowledge", () => ({
  invalidateKnowledgeCache: mockInvalidateKnowledgeCache,
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
  return new NextRequest("http://localhost/api/internal/invalidate-kb", { method: "POST", headers });
}

// --- Tests ---

describe("POST /api/internal/invalidate-kb", () => {
  const CRON_SECRET = "test-cron-secret";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { POST } = await import("../route");
    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header is wrong", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("Bearer wrong-secret");
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 200 with invalidated: true on success", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(`Bearer ${CRON_SECRET}`);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invalidated).toBe(true);
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("calls invalidateKnowledgeCache on success", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(`Bearer ${CRON_SECRET}`);
    await POST(req);

    expect(mockInvalidateKnowledgeCache).toHaveBeenCalledOnce();
  });

  it("does not call invalidateKnowledgeCache when unauthorized", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("Bearer wrong-secret");
    await POST(req);

    expect(mockInvalidateKnowledgeCache).not.toHaveBeenCalled();
  });

  it("allows request and invalidates when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;

    const { POST } = await import("../route");
    const req = makeRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invalidated).toBe(true);
    expect(mockInvalidateKnowledgeCache).toHaveBeenCalledOnce();
  });
});
