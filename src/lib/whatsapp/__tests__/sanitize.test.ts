import { describe, it, expect } from "vitest";
import { sanitizeTemplateParam } from "../sanitize";

describe("sanitizeTemplateParam", () => {
  it("returns single-line text unchanged", () => {
    expect(sanitizeTemplateParam("Recordatorio de reserva")).toBe(
      "Recordatorio de reserva"
    );
  });

  it("replaces single newline with ' · '", () => {
    expect(sanitizeTemplateParam("Línea 1\nLínea 2")).toBe("Línea 1 · Línea 2");
  });

  it("collapses multiple consecutive newlines into a single separator", () => {
    expect(sanitizeTemplateParam("A\n\n\n\nB")).toBe("A · B");
  });

  it("drops empty segments so empty placeholders don't leave dangling separators", () => {
    expect(sanitizeTemplateParam("A\n\nB\n\nC")).toBe("A · B · C");
    expect(sanitizeTemplateParam("Start\n\n\n\nEnd")).toBe("Start · End");
  });

  it("trims whitespace from each segment", () => {
    expect(sanitizeTemplateParam("  A  \n  B  \n  C  ")).toBe("A · B · C");
  });

  it("replaces tabs with spaces", () => {
    expect(sanitizeTemplateParam("col1\tcol2")).toBe("col1 col2");
    expect(sanitizeTemplateParam("A\tB\nC\tD")).toBe("A B · C D");
  });

  it("collapses 5+ consecutive spaces", () => {
    expect(sanitizeTemplateParam("Hola     mundo")).toBe("Hola    mundo");
    expect(sanitizeTemplateParam("A          B")).toBe("A    B");
  });

  it("keeps up to 4 consecutive spaces (Meta's limit)", () => {
    expect(sanitizeTemplateParam("A    B")).toBe("A    B");
    expect(sanitizeTemplateParam("A   B")).toBe("A   B");
  });

  it("handles the real recordatorio template with missing envs and missing precita", () => {
    const rawMessage =
      "Recordatorio de reserva · Mañana a las *{hora}* tenés *{servicio}* · Dirección: {direccion} · {acceso} · {instrucciones_precita} · Mensaje automático, NO responder a este número · Consultas al {telefono}";
    const interpolated = rawMessage
      .replace(/\{hora\}/g, "15:00")
      .replace(/\{servicio\}/g, "Masaje deportivo")
      .replace(/\{direccion\}/g, "")
      .replace(/\{acceso\}/g, "")
      .replace(/\{instrucciones_precita\}/g, "")
      .replace(/\{telefono\}/g, "");

    const result = sanitizeTemplateParam(interpolated);

    expect(result).not.toContain("\n");
    expect(result).not.toContain("\t");
    expect(result).not.toMatch(/ {5,}/);
  });

  it("handles the real recordatorio template with all envs and precita filled", () => {
    const rawMessage =
      "Recordatorio de reserva · Mañana a las *{hora}* tenés *{servicio}* · Dirección: {direccion} · {acceso} · {instrucciones_precita} · Mensaje automático, NO responder a este número · Consultas al {telefono}";
    const interpolated = rawMessage
      .replace(/\{hora\}/g, "15:00")
      .replace(/\{servicio\}/g, "Depilación láser")
      .replace(/\{direccion\}/g, "Av. 18 de Julio 1234")
      .replace(/\{acceso\}/g, "Timbre: VAIG")
      .replace(
        /\{instrucciones_precita\}/g,
        "En caso de que su cita sea para depilación, venir rasurado/a del día anterior."
      )
      .replace(/\{telefono\}/g, "59899999999");

    const result = sanitizeTemplateParam(interpolated);

    expect(result).not.toContain("\n");
    expect(result).toContain("Depilación láser");
    expect(result).toContain("Av. 18 de Julio 1234");
    expect(result).toContain("venir rasurado/a");
    expect(result).toContain("59899999999");
  });

  it("handles the legacy multi-line default (user edits with newlines)", () => {
    const legacyStyle =
      "Recordatorio de reserva\n\nTe recordamos tu turno de *Masaje deportivo* mañana a las *15:00*.\n\nLa dirección es:\n\n\n\n\nEste es un mensaje automático, NO responder a este número.\nComunicarse al .\n\nRespondé *confirmo*.";

    const result = sanitizeTemplateParam(legacyStyle);

    expect(result).not.toContain("\n");
    expect(result).not.toMatch(/ {5,}/);
    expect(result).toContain("Recordatorio de reserva");
    expect(result).toContain("Masaje deportivo");
    expect(result).toContain("NO responder");
  });

  it("returns empty string for all-whitespace input", () => {
    expect(sanitizeTemplateParam("")).toBe("");
    expect(sanitizeTemplateParam("\n\n\n")).toBe("");
    expect(sanitizeTemplateParam("   \n  \t  \n   ")).toBe("");
  });
});
