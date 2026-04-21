/**
 * Tests for pure business logic extracted from recordatorios.ts.
 * Covers getPreCitaInstructions, phone validation, template interpolation,
 * and sendReminders input guard.
 */
import { describe, it, expect } from "vitest";

// --- Pure helpers mirrored from recordatorios.ts ---

function getPreCitaInstructions(category: string | null): string {
  const cat = (category ?? "").toLowerCase();
  if (cat.includes("depilacion") || cat.includes("laser"))
    return "En caso de que su cita sea para depilación, venir rasurado/a del día anterior.";
  if (cat.includes("facial") || cat.includes("cejas") || cat.includes("pestana"))
    return "En caso de que su cita sea limpieza facial, lifting o perfilado de cejas, venir sin maquillaje.";
  return "";
}

function isInvalidPhone(phone: string | null | undefined): boolean {
  if (!phone) return true;
  return phone.startsWith("historico_") || phone.startsWith("migrated_nophone_");
}

function interpolateMessage(
  message: string,
  replacements: {
    hora: string;
    servicio: string;
    direccion: string;
    acceso: string;
    instrucciones_precita: string;
    telefono: string;
  }
): string {
  return message
    .replace(/\{hora\}/g, replacements.hora)
    .replace(/\{servicio\}/g, replacements.servicio)
    .replace(/\{direccion\}/g, replacements.direccion)
    .replace(/\{acceso\}/g, replacements.acceso)
    .replace(/\{instrucciones_precita\}/g, replacements.instrucciones_precita)
    .replace(/\{telefono\}/g, replacements.telefono);
}

function isSendRemindersInputInvalid(bookingIds: string[], message: string): boolean {
  return !bookingIds.length || !message.trim();
}

// --- Tests ---

describe("getPreCitaInstructions", () => {
  it("returns depilacion instructions for 'depilacion' category", () => {
    const result = getPreCitaInstructions("depilacion");
    expect(result).toBe(
      "En caso de que su cita sea para depilación, venir rasurado/a del día anterior."
    );
  });

  it("returns depilacion instructions for 'laser' category", () => {
    const result = getPreCitaInstructions("laser");
    expect(result).toBe(
      "En caso de que su cita sea para depilación, venir rasurado/a del día anterior."
    );
  });

  it("matches 'depilacion' case-insensitively", () => {
    expect(getPreCitaInstructions("DEPILACION")).toBe(
      "En caso de que su cita sea para depilación, venir rasurado/a del día anterior."
    );
    expect(getPreCitaInstructions("Depilacion Laser")).toBe(
      "En caso de que su cita sea para depilación, venir rasurado/a del día anterior."
    );
  });

  it("returns facial instructions for 'facial' category", () => {
    const result = getPreCitaInstructions("facial");
    expect(result).toBe(
      "En caso de que su cita sea limpieza facial, lifting o perfilado de cejas, venir sin maquillaje."
    );
  });

  it("returns facial instructions for 'cejas' category", () => {
    const result = getPreCitaInstructions("cejas");
    expect(result).toBe(
      "En caso de que su cita sea limpieza facial, lifting o perfilado de cejas, venir sin maquillaje."
    );
  });

  it("returns facial instructions for 'pestana' category", () => {
    const result = getPreCitaInstructions("pestana");
    expect(result).toBe(
      "En caso de que su cita sea limpieza facial, lifting o perfilado de cejas, venir sin maquillaje."
    );
  });

  it("returns facial instructions case-insensitively", () => {
    expect(getPreCitaInstructions("FACIAL")).toBe(
      "En caso de que su cita sea limpieza facial, lifting o perfilado de cejas, venir sin maquillaje."
    );
    expect(getPreCitaInstructions("Limpieza Facial")).toBe(
      "En caso de que su cita sea limpieza facial, lifting o perfilado de cejas, venir sin maquillaje."
    );
  });

  it("returns empty string for unrecognized category", () => {
    expect(getPreCitaInstructions("masaje")).toBe("");
    expect(getPreCitaInstructions("nutricion")).toBe("");
    expect(getPreCitaInstructions("otro")).toBe("");
  });

  it("returns empty string for null category", () => {
    expect(getPreCitaInstructions(null)).toBe("");
  });

  it("returns empty string for empty string category", () => {
    expect(getPreCitaInstructions("")).toBe("");
  });

  it("depilacion takes precedence (checked first in the function)", () => {
    // A hypothetical category containing both 'laser' and 'cejas' keywords
    // depilacion/laser branch is checked first, so it wins
    const result = getPreCitaInstructions("laser cejas combo");
    expect(result).toBe(
      "En caso de que su cita sea para depilación, venir rasurado/a del día anterior."
    );
  });
});

describe("isInvalidPhone", () => {
  it("returns true for null phone", () => {
    expect(isInvalidPhone(null)).toBe(true);
  });

  it("returns true for undefined phone", () => {
    expect(isInvalidPhone(undefined)).toBe(true);
  });

  it("returns true for empty string phone", () => {
    expect(isInvalidPhone("")).toBe(true);
  });

  it("returns true for historico_ prefix", () => {
    expect(isInvalidPhone("historico_abc")).toBe(true);
    expect(isInvalidPhone("historico_59899123456")).toBe(true);
  });

  it("returns true for migrated_nophone_ prefix", () => {
    expect(isInvalidPhone("migrated_nophone_xyz")).toBe(true);
    expect(isInvalidPhone("migrated_nophone_123")).toBe(true);
  });

  it("returns false for valid phone numbers", () => {
    expect(isInvalidPhone("59899123456")).toBe(false);
    expect(isInvalidPhone("5491100001111")).toBe(false);
    expect(isInvalidPhone("123456789")).toBe(false);
  });
});

describe("interpolateMessage", () => {
  const baseReplacements = {
    hora: "10:00",
    servicio: "Depilación Láser",
    direccion: "Av. Principal 123",
    acceso: "Portón azul, primer piso",
    instrucciones_precita: "Venir rasurado/a.",
    telefono: "59899000000",
  };

  it("replaces all placeholders", () => {
    const message =
      "Tu cita es a las {hora} para {servicio}. Dirección: {direccion}. Acceso: {acceso}. {instrucciones_precita} Contacto: {telefono}";
    const result = interpolateMessage(message, baseReplacements);
    expect(result).toBe(
      "Tu cita es a las 10:00 para Depilación Láser. Dirección: Av. Principal 123. Acceso: Portón azul, primer piso. Venir rasurado/a. Contacto: 59899000000"
    );
  });

  it("replaces multiple occurrences of the same placeholder", () => {
    const message = "{servicio} - {servicio}";
    const result = interpolateMessage(message, baseReplacements);
    expect(result).toBe("Depilación Láser - Depilación Láser");
  });

  it("returns message unchanged when no placeholders present", () => {
    const message = "Mensaje sin placeholders";
    const result = interpolateMessage(message, baseReplacements);
    expect(result).toBe("Mensaje sin placeholders");
  });

  it("handles empty string replacements (env vars not set)", () => {
    const emptyReplacements = {
      hora: "14:30",
      servicio: "Facial",
      direccion: "",
      acceso: "",
      instrucciones_precita: "",
      telefono: "",
    };
    const message = "Cita a las {hora}: {servicio}. Dir: {direccion}. Tel: {telefono}.";
    const result = interpolateMessage(message, emptyReplacements);
    expect(result).toBe("Cita a las 14:30: Facial. Dir: . Tel: .");
  });

  it("handles empty message template", () => {
    const result = interpolateMessage("", baseReplacements);
    expect(result).toBe("");
  });

  it("only replaces known placeholder patterns (curly-brace syntax)", () => {
    const message = "Hola {nombre}, tu cita es a las {hora}";
    const result = interpolateMessage(message, baseReplacements);
    // {nombre} is not a known placeholder — stays unchanged
    expect(result).toBe("Hola {nombre}, tu cita es a las 10:00");
  });
});

describe("isSendRemindersInputInvalid", () => {
  it("returns true for empty bookingIds array", () => {
    expect(isSendRemindersInputInvalid([], "Recordatorio")).toBe(true);
  });

  it("returns true for empty message string", () => {
    expect(isSendRemindersInputInvalid(["id-1"], "")).toBe(true);
  });

  it("returns true for whitespace-only message", () => {
    expect(isSendRemindersInputInvalid(["id-1"], "   ")).toBe(true);
    expect(isSendRemindersInputInvalid(["id-1"], "\t\n")).toBe(true);
  });

  it("returns true for both empty bookingIds and empty message", () => {
    expect(isSendRemindersInputInvalid([], "")).toBe(true);
  });

  it("returns false for valid bookingIds and message", () => {
    expect(isSendRemindersInputInvalid(["id-1"], "Recordatorio")).toBe(false);
    expect(isSendRemindersInputInvalid(["id-1", "id-2"], "Tu cita")).toBe(false);
  });

  it("returns false for message that has content after trimming", () => {
    expect(isSendRemindersInputInvalid(["id-1"], "  hola  ")).toBe(false);
  });
});

describe("sendReminders — business rules", () => {
  it("a booking with no phone should fail (not be sent)", () => {
    // Mirrors the guard: skip bookings where phone is null/undefined
    expect(isInvalidPhone(null)).toBe(true);
  });

  it("a booking with valid phone should proceed", () => {
    expect(isInvalidPhone("59899123456")).toBe(false);
  });

  it("depilacion booking gets category-specific instructions in message", () => {
    const instructions = getPreCitaInstructions("depilacion");
    expect(instructions).not.toBe("");
    const message = "Tu turno. {instrucciones_precita}";
    const result = interpolateMessage(message, {
      hora: "10:00",
      servicio: "Depilación",
      direccion: "",
      acceso: "",
      instrucciones_precita: instructions,
      telefono: "",
    });
    expect(result).toContain("rasurado");
  });

  it("massage booking gets no specific instructions (empty string)", () => {
    const instructions = getPreCitaInstructions("masaje");
    expect(instructions).toBe("");
    const message = "Tu turno. {instrucciones_precita}";
    const result = interpolateMessage(message, {
      hora: "10:00",
      servicio: "Masaje",
      direccion: "",
      acceso: "",
      instrucciones_precita: instructions,
      telefono: "",
    });
    expect(result).toBe("Tu turno. ");
  });

  it("template uses correct placeholder format (curly braces)", () => {
    const placeholders = [
      "{hora}",
      "{servicio}",
      "{direccion}",
      "{acceso}",
      "{instrucciones_precita}",
      "{telefono}",
    ];
    const template = placeholders.join(" ");
    const result = interpolateMessage(template, {
      hora: "H",
      servicio: "S",
      direccion: "D",
      acceso: "A",
      instrucciones_precita: "I",
      telefono: "T",
    });
    expect(result).toBe("H S D A I T");
  });
});
