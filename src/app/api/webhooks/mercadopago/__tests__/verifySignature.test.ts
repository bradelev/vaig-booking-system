import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { createHmac } from "node:crypto";
import { verifySignature } from "../route";

const SECRET = "test-webhook-secret";

function makeSignature(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("verifySignature (MP webhook)", () => {
  beforeAll(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  });

  afterAll(() => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  });

  it("returns true for a valid signature", () => {
    const dataId = "pay-123";
    const requestId = "req-456";
    const ts = "1700000000";
    const sig = makeSignature(dataId, requestId, ts);
    const result = verifySignature("", sig, requestId, dataId);
    expect(result).toBe(true);
  });

  it("returns false when v1 hash is wrong", () => {
    const dataId = "pay-123";
    const requestId = "req-456";
    const ts = "1700000000";
    const badSig = `ts=${ts},v1=badc0ffee0000000000000000000000000000000000000000000000000000000`;
    const result = verifySignature("", badSig, requestId, dataId);
    expect(result).toBe(false);
  });

  it("returns false when timestamp is tampered", () => {
    const dataId = "pay-123";
    const requestId = "req-456";
    const ts = "1700000000";
    const sig = makeSignature(dataId, requestId, ts);
    // Replace the timestamp in the signature header with a different value
    const tamperedSig = sig.replace(`ts=${ts}`, "ts=9999999999");
    const result = verifySignature("", tamperedSig, requestId, dataId);
    expect(result).toBe(false);
  });

  it("returns false when xSignature is null", () => {
    const result = verifySignature("", null, "req-1", "pay-1");
    expect(result).toBe(false);
  });

  it("returns false when signature format is missing ts or v1", () => {
    const result = verifySignature("", "invalid-format", "req-1", "pay-1");
    expect(result).toBe(false);
  });

  it("returns false when dataId is different", () => {
    const requestId = "req-456";
    const ts = "1700000000";
    const sig = makeSignature("pay-original", requestId, ts);
    // Use a different dataId when verifying
    const result = verifySignature("", sig, requestId, "pay-different");
    expect(result).toBe(false);
  });

  it("returns false when requestId is different", () => {
    const dataId = "pay-123";
    const ts = "1700000000";
    const sig = makeSignature(dataId, "req-original", ts);
    // Use a different requestId when verifying
    const result = verifySignature("", sig, "req-different", dataId);
    expect(result).toBe(false);
  });

  it("returns false when secret is not set (fail-closed)", () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const result = verifySignature("", "ts=1,v1=abc", "req-1", "pay-1");
    expect(result).toBe(false);
    // Restore
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  });

  it("handles null dataId and requestId gracefully", () => {
    const ts = "1700000000";
    const manifest = `id:;request-id:;ts:${ts};`;
    const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
    const sig = `ts=${ts},v1=${v1}`;
    // Null dataId/requestId are treated as empty strings
    const result = verifySignature("", sig, null, null);
    expect(result).toBe(true);
  });
});
