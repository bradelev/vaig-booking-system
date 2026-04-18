import { describe, it, expect } from "vitest";
import { isHandoffTrigger } from "../handoff";

describe("isHandoffTrigger", () => {
  it("returns true for 'hablar con persona'", () => {
    expect(isHandoffTrigger("hablar con persona")).toBe(true);
  });

  it("returns true for 'operador'", () => {
    expect(isHandoffTrigger("operador")).toBe(true);
  });

  it("returns true for 'operadora'", () => {
    expect(isHandoffTrigger("operadora")).toBe(true);
  });

  it("returns true for 'humano'", () => {
    expect(isHandoffTrigger("quiero hablar con un humano")).toBe(true);
  });

  it("returns true for 'agente'", () => {
    expect(isHandoffTrigger("necesito un agente")).toBe(true);
  });

  it("returns true for 'persona real'", () => {
    expect(isHandoffTrigger("quiero hablar con una persona real")).toBe(true);
  });

  it("returns true for 'atencion humana' (with accent)", () => {
    expect(isHandoffTrigger("necesito atención humana")).toBe(true);
  });

  it("returns false for regular booking message", () => {
    expect(isHandoffTrigger("quiero reservar un turno")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isHandoffTrigger("")).toBe(false);
  });

  it("returns false for 'hola'", () => {
    expect(isHandoffTrigger("hola")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isHandoffTrigger("HABLAR CON PERSONA")).toBe(true);
    expect(isHandoffTrigger("Operador")).toBe(true);
  });

  it("handles accented characters", () => {
    expect(isHandoffTrigger("atención humana")).toBe(true);
  });
});
