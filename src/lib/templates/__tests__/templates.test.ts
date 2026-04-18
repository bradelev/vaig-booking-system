import { describe, it, expect } from "vitest";
import { TEMPLATE_KEYS, TEMPLATE_LABELS, TEMPLATE_PLACEHOLDERS } from "@/lib/templates";
import type { TemplateKey } from "@/lib/templates";

describe("TEMPLATE_KEYS", () => {
  it("is a non-empty readonly array of strings", () => {
    expect(Array.isArray(TEMPLATE_KEYS)).toBe(true);
    expect(TEMPLATE_KEYS.length).toBeGreaterThan(0);
    TEMPLATE_KEYS.forEach((k) => expect(typeof k).toBe("string"));
  });

  it("contains expected core templates", () => {
    expect(TEMPLATE_KEYS).toContain("template_reminder");
    expect(TEMPLATE_KEYS).toContain("template_survey");
    expect(TEMPLATE_KEYS).toContain("template_cancel_client");
    expect(TEMPLATE_KEYS).toContain("template_admin_new_booking");
  });
});

describe("TEMPLATE_LABELS", () => {
  it("has a label for every key", () => {
    for (const key of TEMPLATE_KEYS) {
      expect(TEMPLATE_LABELS[key as TemplateKey], `Missing label for ${key}`).toBeDefined();
      expect(typeof TEMPLATE_LABELS[key as TemplateKey]).toBe("string");
      expect(TEMPLATE_LABELS[key as TemplateKey].length).toBeGreaterThan(0);
    }
  });

  it("no extra keys beyond TEMPLATE_KEYS", () => {
    const labelKeys = Object.keys(TEMPLATE_LABELS);
    for (const key of labelKeys) {
      expect(TEMPLATE_KEYS).toContain(key);
    }
  });
});

describe("TEMPLATE_PLACEHOLDERS", () => {
  it("has placeholders for every key", () => {
    for (const key of TEMPLATE_KEYS) {
      const placeholders = TEMPLATE_PLACEHOLDERS[key as TemplateKey];
      expect(Array.isArray(placeholders), `${key} placeholders should be an array`).toBe(true);
    }
  });

  it("all placeholders use {camelCase} format", () => {
    for (const key of TEMPLATE_KEYS) {
      const placeholders = TEMPLATE_PLACEHOLDERS[key as TemplateKey];
      for (const ph of placeholders) {
        expect(ph).toMatch(/^\{[a-zA-Z]+\}$/);
      }
    }
  });

  it("reminder template includes {firstName} and {serviceName}", () => {
    const phs = TEMPLATE_PLACEHOLDERS["template_reminder"];
    expect(phs).toContain("{firstName}");
    expect(phs).toContain("{serviceName}");
    expect(phs).toContain("{dateLabel}");
  });

  it("admin booking template includes booking-specific placeholders", () => {
    const phs = TEMPLATE_PLACEHOLDERS["template_admin_new_booking"];
    expect(phs).toContain("{clientName}");
    expect(phs).toContain("{bookingId}");
    expect(phs).toContain("{professionalName}");
  });
});
