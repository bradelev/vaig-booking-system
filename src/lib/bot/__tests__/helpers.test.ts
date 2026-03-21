import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  isMenuTrigger,
  isCancelTrigger,
  isRescheduleTrigger,
  isMisTurnosTrigger,
  formatDateLabel,
  parseUserDateTime,
} from "../helpers";

describe("normalize", () => {
  it("lowercases, strips accents, and trims", () => {
    assert.equal(normalize("  Héllo Wörld  "), "hello world");
    assert.equal(normalize("MAÑANA"), "manana");
    assert.equal(normalize("Sábado"), "sabado");
    assert.equal(normalize("Miércoles"), "miercoles");
  });
});

describe("isMenuTrigger", () => {
  it("returns true for menu keywords", () => {
    assert.equal(isMenuTrigger("menu"), true);
    assert.equal(isMenuTrigger("MENU"), true);
    assert.equal(isMenuTrigger("inicio"), true);
    assert.equal(isMenuTrigger("hola"), true);
    assert.equal(isMenuTrigger("Hola!"), true);
    assert.equal(isMenuTrigger("hi"), true);
    assert.equal(isMenuTrigger("0"), true);
    assert.equal(isMenuTrigger("volver"), true);
  });

  it("returns false for non-menu text", () => {
    assert.equal(isMenuTrigger("cancelar"), false);
    assert.equal(isMenuTrigger("mis turnos"), false);
    assert.equal(isMenuTrigger("reagendar"), false);
  });
});

describe("isCancelTrigger", () => {
  it("returns true for cancel keywords", () => {
    assert.equal(isCancelTrigger("cancelar"), true);
    assert.equal(isCancelTrigger("CANCELAR"), true);
    assert.equal(isCancelTrigger("cancel"), true);
    assert.equal(isCancelTrigger("salir"), true);
    assert.equal(isCancelTrigger("quiero cancelar"), true);
  });

  it("returns false for non-cancel text", () => {
    assert.equal(isCancelTrigger("hola"), false);
    assert.equal(isCancelTrigger("mis turnos"), false);
  });
});

describe("isRescheduleTrigger", () => {
  it("returns true for reschedule keywords", () => {
    assert.equal(isRescheduleTrigger("cambiar turno"), true);
    assert.equal(isRescheduleTrigger("CAMBIAR TURNO"), true);
    assert.equal(isRescheduleTrigger("reagendar"), true);
    assert.equal(isRescheduleTrigger("reprogramar"), true);
    assert.equal(isRescheduleTrigger("cambiar cita"), true);
    assert.equal(isRescheduleTrigger("cambiar reserva"), true);
  });

  it("returns false for non-reschedule text", () => {
    assert.equal(isRescheduleTrigger("hola"), false);
    assert.equal(isRescheduleTrigger("cancelar"), false);
    assert.equal(isRescheduleTrigger("mis turnos"), false);
  });
});

describe("isMisTurnosTrigger", () => {
  it("returns true for known patterns", () => {
    assert.equal(isMisTurnosTrigger("mis turnos"), true);
    assert.equal(isMisTurnosTrigger("MIS TURNOS"), true);
    assert.equal(isMisTurnosTrigger("mis citas"), true);
    assert.equal(isMisTurnosTrigger("mis reservas"), true);
    assert.equal(isMisTurnosTrigger("ver turno"), true);
    assert.equal(isMisTurnosTrigger("ver reserva"), true);
    assert.equal(isMisTurnosTrigger("historial"), true);
    assert.equal(isMisTurnosTrigger("HISTORIAL"), true);
  });

  it("returns false when text contains historial but is not exact (normalized)", () => {
    // "historial" must match the full normalized text — here it is a substring so it won't match t === "historial"
    // but "ver mi historial" should NOT match (it's not in any includes check)
    assert.equal(isMisTurnosTrigger("ver mi historial"), false);
  });

  it("returns false for unrelated text", () => {
    assert.equal(isMisTurnosTrigger("hola"), false);
    assert.equal(isMisTurnosTrigger("cancelar"), false);
    assert.equal(isMisTurnosTrigger("reagendar"), false);
  });
});

describe("formatDateLabel", () => {
  it("returns a human-readable label in Spanish", () => {
    // 2026-03-23 10:00 ART (Monday)
    const date = new Date("2026-03-23T13:00:00.000Z"); // 10:00 ART = UTC-3
    const label = formatDateLabel(date);
    // Should contain "lunes" and "10:00"
    assert.ok(label.toLowerCase().includes("lunes"), `Expected 'lunes' in: ${label}`);
    assert.ok(label.includes("10:00"), `Expected '10:00' in: ${label}`);
  });

  it("returns correct day for a Saturday", () => {
    // 2026-03-21 14:00 ART (Saturday)
    const date = new Date("2026-03-21T17:00:00.000Z"); // 14:00 ART
    const label = formatDateLabel(date);
    assert.ok(label.toLowerCase().includes("sábado") || label.toLowerCase().includes("sabado"), `Expected 'sábado' in: ${label}`);
  });
});

describe("parseUserDateTime", () => {
  it("returns null when no time pattern found", () => {
    assert.equal(parseUserDateTime("hola"), null);
    assert.equal(parseUserDateTime("mañana"), null);
    assert.equal(parseUserDateTime("lunes"), null);
  });

  it("parses 'mañana HH:MM' and sets correct time", () => {
    const result = parseUserDateTime("mañana 10:00");
    assert.ok(result !== null, "Expected a date");
    assert.equal(result!.getHours(), 10);
    assert.equal(result!.getMinutes(), 0);
    // Result should be in the future
    assert.ok(result! > new Date(), `Expected future date, got ${result}`);
  });

  it("parses 'pasado mañana HH:MM' and sets correct time", () => {
    const result = parseUserDateTime("pasado mañana 14:30");
    assert.ok(result !== null);
    // Verify time components are set correctly
    assert.equal(result!.getHours(), 14);
    assert.equal(result!.getMinutes(), 30);
    // Result should be in the future
    assert.ok(result! > new Date(), `Expected future date, got ${result}`);
  });

  it("parses 'viernes HH:MM' and lands on next Friday", () => {
    const now = new Date();
    const result = parseUserDateTime("viernes 09:00");
    assert.ok(result !== null);
    assert.equal(result!.getDay(), 5); // Friday = 5
    assert.equal(result!.getHours(), 9);
    // Must be in the future
    assert.ok(result! > now, "Expected future date");
  });

  it("parses 'lunes' — if today is Monday, returns next Monday", () => {
    const result = parseUserDateTime("lunes 11:00");
    assert.ok(result !== null);
    assert.equal(result!.getDay(), 1); // Monday = 1
    assert.ok(result! > new Date(), "Expected future date");
  });

  it("parses DD/MM date pattern", () => {
    // Use a future date to avoid year rollover ambiguity
    const result = parseUserDateTime("15/06 10:00");
    assert.ok(result !== null);
    assert.equal(result!.getDate(), 15);
    assert.equal(result!.getMonth(), 5); // June = 5
    assert.equal(result!.getHours(), 10);
  });

  it("parses uppercase day name (VIERNES)", () => {
    const result = parseUserDateTime("VIERNES 15:00");
    assert.ok(result !== null);
    assert.equal(result!.getDay(), 5);
  });
});
