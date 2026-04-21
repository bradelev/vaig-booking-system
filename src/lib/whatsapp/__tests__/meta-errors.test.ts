import { describe, it, expect } from "vitest";
import { describeMetaError, formatWebhookError } from "../meta-errors";

describe("describeMetaError", () => {
  it("returns friendly message for a mapped code", () => {
    const result = describeMetaError(131026);
    expect(result.code).toBe(131026);
    expect(result.friendly).toContain("WhatsApp activo");
    expect(result.title).toBeTruthy();
  });

  it("returns friendly message for user opted-out code", () => {
    const result = describeMetaError(131050);
    expect(result.friendly).toContain("marketing");
  });

  it("returns friendly message for 132018 (parameter error)", () => {
    const result = describeMetaError(132018);
    expect(result.friendly).toContain("parámetros");
  });

  it("returns fallback for unmapped code without fallbackMessage", () => {
    const result = describeMetaError(999999);
    expect(result.code).toBe(999999);
    expect(result.friendly).toContain("999999");
    expect(result.title).toBe("Error de Meta");
  });

  it("uses custom fallbackMessage for unmapped code", () => {
    const result = describeMetaError(999999, "Mi error personalizado");
    expect(result.friendly).toBe("Mi error personalizado");
  });

  it("covers the 470 legacy code", () => {
    const result = describeMetaError(470);
    expect(result.friendly).toContain("24 h");
  });
});

describe("formatWebhookError", () => {
  it("returns null pair for undefined", () => {
    expect(formatWebhookError(undefined)).toEqual({ errorCode: null, errorMessage: null });
  });

  it("returns null pair for empty array", () => {
    expect(formatWebhookError([])).toEqual({ errorCode: null, errorMessage: null });
  });

  it("maps a single known error code to friendly message", () => {
    const result = formatWebhookError([{ code: 131026, title: "Message undeliverable" }]);
    expect(result.errorCode).toBe(131026);
    expect(result.errorMessage).toContain("WhatsApp activo");
  });

  it("uses error_data.details as suffix when present", () => {
    const result = formatWebhookError([
      { code: 131026, title: "Message undeliverable", error_data: { details: "Phone not on WA" } },
    ]);
    expect(result.errorMessage).toContain("Phone not on WA");
  });

  it("concatenates multiple errors with ' · '", () => {
    const result = formatWebhookError([
      { code: 131026, title: "Error A" },
      { code: 131050, title: "Error B" },
    ]);
    expect(result.errorCode).toBe(131026);
    expect(result.errorMessage).toContain(" · ");
    expect(result.errorMessage).toContain("WhatsApp activo");
    expect(result.errorMessage).toContain("marketing");
  });

  it("falls back gracefully for unknown code — includes code number in message", () => {
    const result = formatWebhookError([{ code: 99999 }]);
    expect(result.errorCode).toBe(99999);
    expect(result.errorMessage).toContain("99999");
  });

  it("uses title as fallback message when code is unmapped and title is provided", () => {
    const result = formatWebhookError([{ code: 99999, title: "Some unknown error" }]);
    expect(result.errorCode).toBe(99999);
    // title is used as fallbackMessage → describeMetaError uses it
    expect(result.errorMessage).toContain("Some unknown error");
  });
});
