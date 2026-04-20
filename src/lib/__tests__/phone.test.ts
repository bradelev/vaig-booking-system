import { describe, it, expect } from "vitest";
import { normalizePhone } from "../phone";

describe("normalizePhone", () => {
  it("strips 598 prefix from 11-digit number", () => {
    expect(normalizePhone("59894020096")).toBe("94020096");
  });

  it("keeps number without 598 prefix unchanged", () => {
    expect(normalizePhone("94020096")).toBe("94020096");
  });

  it("strips non-digit characters", () => {
    expect(normalizePhone("094 020 096")).toBe("094020096");
    // +598-94-020-096 → digits = 59894020096 (11 digits, starts with 598) → strips to 94020096
    expect(normalizePhone("+598-94-020-096")).toBe("94020096");
  });

  it("does not strip 598 when result length is not 8", () => {
    // 598 + 6 digits → not 11 digits total, should not strip
    expect(normalizePhone("598123456")).toBe("598123456");
  });

  it("handles empty string", () => {
    expect(normalizePhone("")).toBe("");
  });

  it("handles null-like input gracefully", () => {
    // @ts-expect-error testing runtime safety
    expect(normalizePhone(null)).toBe("");
  });
});
