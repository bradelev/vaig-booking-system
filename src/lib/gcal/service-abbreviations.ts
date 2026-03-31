/**
 * Service abbreviation mapping for GCal event summary parsing.
 *
 * Maps short abbreviations (used by professionals in GCal event titles)
 * to arrays of possible service name substrings for matching against the DB.
 */
import { distance } from "fastest-levenshtein";

/** abbrev → possible service name substrings to match (case-insensitive) */
export const ABBREVIATION_MAP: Record<string, string[]> = {
  // Masajes
  "mt":    ["masaje terapeutico", "masaje terapéutico"],
  "mas":   ["masaje"],
  "masaje":["masaje"],
  "me":    ["masaje estetico", "masaje estético"],
  "mr":    ["masaje revitalizante"],
  "md":    ["masaje deportivo"],
  "emb":   ["embarazadas", "masaje embarazadas"],

  // Depilacion Laser — zonas corporales
  "ax":    ["axila"],
  "axi":   ["axila"],
  "bb":    ["bozo", "bozo y barbilla"],
  "bz":    ["bozo"],
  "cc":    ["cavado completo", "bikini cavado completo"],
  "cav":   ["cavado", "bikini cavado"],
  "pc":    ["pierna completa", "pierna entera"],
  "mp":    ["media pierna"],
  "lp":    ["labio", "labio superior"],
  "ing":   ["ingle", "bikini ingle"],
  "bk":    ["bikini"],
  "biq":   ["bikini"],
  "ab":    ["abdomen"],
  "gl":    ["gluteos", "glúteos"],
  "es":    ["espalda"],
  "br":    ["brazos"],
  "bra":   ["brazos"],
  "an":    ["antebrazo"],
  "pe":    ["pecho"],
  "pec":   ["pecho"],
  "cu":    ["cuello"],
  "mn":    ["menton", "mentón"],

  // Facial
  "lc":    ["limpieza"],
  "lim":   ["limpieza"],
  "hid":   ["hidratacion", "hidratación"],
  "hd":    ["hidratacion", "hidratación"],
  "peel":  ["peeling"],
  "pk":    ["peeling"],

  // Cejas y Pestanas
  "cj":    ["cejas", "diseño cejas", "diseno cejas"],
  "cej":   ["cejas", "diseño cejas", "diseno cejas"],
  "lift":  ["lifting", "lifting de pestanas", "lifting de pestañas"],

  // Manos y Pies
  "man":   ["manicuria", "manicuría"],
  "ped":   ["pedicuria", "pedicuría"],
  "pd":    ["pedicuria", "pedicuría"],
  "semi":  ["semipermanente"],
  "sp":    ["semipermanente"],
  "acr":   ["acrilico", "acrílico"],

  // Otros / Especiales
  "spa":   ["day spa", "spa"],
  "hifu":  ["hifu"],
  "rf":    ["radiofrecuencia"],
  "combo": ["combo"],
};

export interface MatchResult {
  serviceId: string;
  serviceName: string;
  abbreviation: string;
  confidence: "exact" | "fuzzy" | "unmatched";
}

/**
 * Matches an array of abbreviations against a list of DB services.
 *
 * For each abbreviation:
 *  1. Look up ABBREVIATION_MAP to get candidate substrings.
 *  2. Try exact substring match (case-insensitive) against service names.
 *  3. Fall back to Levenshtein fuzzy match (distance <= 5) against candidate strings.
 *  4. If still unmatched, return confidence="unmatched".
 */
export function matchServicesToAbbreviations(
  abbreviations: string[],
  dbServices: Array<{ id: string; name: string }>,
): MatchResult[] {
  return abbreviations.map((abbrev) => {
    const candidates = ABBREVIATION_MAP[abbrev.toLowerCase()];

    if (!candidates || candidates.length === 0) {
      return {
        serviceId: "",
        serviceName: "",
        abbreviation: abbrev,
        confidence: "unmatched",
      };
    }

    // --- 1. Exact substring match ---
    for (const service of dbServices) {
      const nameLower = service.name.toLowerCase();
      for (const candidate of candidates) {
        if (nameLower.includes(candidate.toLowerCase())) {
          return {
            serviceId: service.id,
            serviceName: service.name,
            abbreviation: abbrev,
            confidence: "exact",
          };
        }
      }
    }

    // --- 2. Fuzzy match via Levenshtein ---
    let bestService: { id: string; name: string } | null = null;
    let bestDist = Infinity;

    for (const service of dbServices) {
      const nameLower = service.name.toLowerCase();
      for (const candidate of candidates) {
        const d = distance(nameLower, candidate.toLowerCase());
        if (d < bestDist) {
          bestDist = d;
          bestService = service;
        }
      }
    }

    // Accept fuzzy match only within a generous threshold
    if (bestService && bestDist <= 5) {
      return {
        serviceId: bestService.id,
        serviceName: bestService.name,
        abbreviation: abbrev,
        confidence: "fuzzy",
      };
    }

    return {
      serviceId: "",
      serviceName: "",
      abbreviation: abbrev,
      confidence: "unmatched",
    };
  });
}
