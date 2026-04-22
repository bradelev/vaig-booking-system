import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifySignature } from "../route";

function makeValidSignature(secret: string, dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

describe("verifySignature (MP webhook)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when MERCADOPAGO_WEBHOOK_SECRET is not set (fail-closed)", () => {
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "");
    const result = verifySignature("payload", "ts=1,v1=abc", "req-1", "data-1");
    expect(result).toBe(false);
  });

  it("returns false when x-signature header is missing", () => {
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "secret");
    const result = verifySignature("payload", null, "req-1", "data-1");
    expect(result).toBe(false);
  });

  it("returns false for a tampered payload", () => {
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "correct-secret");
    const sig = makeValidSignature("correct-secret", "data-1", "req-1", "1000");
    const result = verifySignature("payload", sig, "req-1", "TAMPERED");
    expect(result).toBe(false);
  });

  it("returns false for a wrong secret", () => {
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "correct-secret");
    const sig = makeValidSignature("wrong-secret", "data-1", "req-1", "1000");
    const result = verifySignature("payload", sig, "req-1", "data-1");
    expect(result).toBe(false);
  });

  it("returns true for a valid signature", () => {
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "correct-secret");
    const sig = makeValidSignature("correct-secret", "data-1", "req-1", "1000");
    const result = verifySignature("payload", sig, "req-1", "data-1");
    expect(result).toBe(true);
  });
});
