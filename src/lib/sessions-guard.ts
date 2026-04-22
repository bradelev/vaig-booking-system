/**
 * Pure guard for the sessions_used increment logic (VBS-216).
 * Prevents sessions_used from exceeding sessions_total — mirrors the DB
 * CHECK constraint sessions_used_valid at the application level.
 */

export function shouldIncrementSessionsUsed(
  sessionsUsed: number,
  sessionsTotal: number
): boolean {
  return sessionsUsed < sessionsTotal;
}

export function applySessionsUsedGuard(
  sessionsUsed: number,
  sessionsTotal: number
): { incremented: boolean; newSessionsUsed: number } {
  if (sessionsUsed >= sessionsTotal) {
    return { incremented: false, newSessionsUsed: sessionsUsed };
  }
  return { incremented: true, newSessionsUsed: sessionsUsed + 1 };
}
