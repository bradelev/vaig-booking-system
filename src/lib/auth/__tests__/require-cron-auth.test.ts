import { describe, it, expect, vi, afterEach } from "vitest";
import { requireCronAuth } from "../require-cron-auth";

function makeRequest(authHeader?: string): Request {
  return new Request("https://example.com/api/internal/test", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("requireCronAuth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 500 when CRON_SECRET is not set", () => {
    vi.stubEnv("CRON_SECRET", "");
    const result = requireCronAuth(makeRequest("Bearer anything"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(500);
  });

  it("returns 401 when authorization header is missing", () => {
    vi.stubEnv("CRON_SECRET", "mysecret");
    const result = requireCronAuth(makeRequest());
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when authorization header has wrong token", () => {
    vi.stubEnv("CRON_SECRET", "mysecret");
    const result = requireCronAuth(makeRequest("Bearer wrongtoken"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when bearer prefix is missing", () => {
    vi.stubEnv("CRON_SECRET", "mysecret");
    const result = requireCronAuth(makeRequest("mysecret"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns null when authorization header is correct", () => {
    vi.stubEnv("CRON_SECRET", "mysecret");
    const result = requireCronAuth(makeRequest("Bearer mysecret"));
    expect(result).toBeNull();
  });
});
