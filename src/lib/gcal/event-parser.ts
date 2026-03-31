/**
 * GCal event summary parser.
 *
 * GCal events created manually by professionals follow the convention:
 *   "<ClientName> <abbrev1> <abbrev2> ..."
 *
 * Events created by this system start with "VAIG:" and are skipped.
 */
import { ABBREVIATION_MAP } from "./service-abbreviations";

export interface ParsedEvent {
  /** Extracted client name (title-cased). */
  clientName: string;
  /** Lowercase abbreviation tokens extracted from the summary. */
  abbreviations: string[];
  /** True if the summary starts with "VAIG:" — these are system-created events. */
  isSystemCreated: boolean;
}

/**
 * Converts a string to title case (e.g. "maria garcia" → "Maria Garcia").
 */
function toTitleCase(str: string): string {
  return str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns true if the token looks like an abbreviation (exists in ABBREVIATION_MAP).
 */
function isKnownAbbreviation(token: string): boolean {
  return token.toLowerCase() in ABBREVIATION_MAP;
}

/**
 * Count how many tokens in an array are known abbreviations.
 */
function countMatches(tokens: string[]): number {
  return tokens.filter((t) => isKnownAbbreviation(t)).length;
}

/**
 * Parses a GCal event summary into client name and service abbreviations.
 *
 * Strategy:
 *   1. If summary starts with "VAIG:", mark as system-created and return early.
 *   2. Try 1-word client name (tokens[0]) vs 2-word client name (tokens[0..1]).
 *   3. Pick the interpretation that yields more abbreviation matches.
 *   4. Any remaining tokens that are not known abbreviations are still included
 *      (they may be fuzzy-matched later by the engine).
 */
export function parseEventSummary(summary: string): ParsedEvent {
  const trimmed = summary.trim();

  if (trimmed.startsWith("VAIG:")) {
    return { clientName: "", abbreviations: [], isSystemCreated: true };
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return { clientName: "", abbreviations: [], isSystemCreated: false };
  }

  if (tokens.length === 1) {
    // Only a name, no abbreviations
    return {
      clientName: toTitleCase(tokens[0]),
      abbreviations: [],
      isSystemCreated: false,
    };
  }

  // Interpretation A: 1-word name
  const nameA = tokens[0];
  const abbrevA = tokens.slice(1);

  // Interpretation B: 2-word name (only if we have at least 2 tokens after name)
  const nameB = tokens.slice(0, 2).join(" ");
  const abbrevB = tokens.slice(2);

  // Pick the interpretation that has more known abbreviation matches
  const scoreA = countMatches(abbrevA);
  const scoreB = countMatches(abbrevB);

  let clientName: string;
  let abbreviations: string[];

  if (tokens.length === 2) {
    // Could be "FirstName LastName" with no abbreviations, or "Name abbrev"
    // Prefer 2-word name if the second token is NOT a known abbreviation
    if (!isKnownAbbreviation(tokens[1])) {
      clientName = toTitleCase(nameB);
      abbreviations = [];
    } else {
      clientName = toTitleCase(nameA);
      abbreviations = abbrevA.map((t) => t.toLowerCase());
    }
  } else if (scoreB >= scoreA && abbrevB.length > 0) {
    clientName = toTitleCase(nameB);
    abbreviations = abbrevB.map((t) => t.toLowerCase());
  } else {
    clientName = toTitleCase(nameA);
    abbreviations = abbrevA.map((t) => t.toLowerCase());
  }

  return { clientName, abbreviations, isSystemCreated: false };
}
