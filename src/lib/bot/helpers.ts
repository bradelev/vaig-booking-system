/**
 * Pure helper functions extracted from the bot engine.
 * No I/O dependencies — safe to unit test in isolation.
 */

const TZ = "America/Argentina/Buenos_Aires";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isMenuTrigger(text: string): boolean {
  const t = normalize(text);
  return ["menu", "inicio", "hola", "hi", "0", "volver"].some((kw) => t.includes(kw));
}

export function isCancelTrigger(text: string): boolean {
  const t = normalize(text);
  return ["cancelar", "cancel", "salir"].some((kw) => t.includes(kw));
}

export function isRescheduleTrigger(text: string): boolean {
  const t = normalize(text);
  return (
    t.includes("cambiar turno") ||
    t.includes("reagendar") ||
    t.includes("reprogramar") ||
    t.includes("cambiar cita") ||
    t.includes("cambiar reserva")
  );
}

export function isMisTurnosTrigger(text: string): boolean {
  const t = normalize(text);
  return (
    t.includes("mis turnos") ||
    t.includes("mis citas") ||
    t.includes("mis reservas") ||
    t.includes("ver turno") ||
    t.includes("ver reserva") ||
    t === "historial"
  );
}

export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function parseUserDateTime(text: string): Date | null {
  // Try to parse patterns like "viernes 10:00", "17/03 15:30", "mañana 10:00"
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;

  const hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);

  const now = new Date();
  const candidate = new Date(now);

  const t = normalize(text);

  if (t.includes("manana") || t.includes("mañana")) {
    candidate.setDate(now.getDate() + 1);
  } else if (t.includes("pasado")) {
    candidate.setDate(now.getDate() + 2);
  } else {
    // Try day name
    const dayMap: Record<string, number> = {
      domingo: 0, lunes: 1, martes: 2, miercoles: 3,
      jueves: 4, viernes: 5, sabado: 6,
    };
    for (const [name, dayNum] of Object.entries(dayMap)) {
      if (t.includes(name)) {
        const currentDay = now.getDay();
        let daysAhead = (dayNum - currentDay + 7) % 7;
        if (daysAhead === 0) daysAhead = 7; // next week same day
        candidate.setDate(now.getDate() + daysAhead);
        break;
      }
    }

    // Try dd/mm pattern
    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
      candidate.setMonth(month, day);
      if (candidate < now) candidate.setFullYear(now.getFullYear() + 1);
    }
  }

  candidate.setHours(hour, minute, 0, 0);
  return candidate;
}
