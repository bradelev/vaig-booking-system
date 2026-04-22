import { logger } from "@/lib/logger";

/**
 * Fail-closed cron auth helper.
 * Returns a Response to send immediately if the request is not authorized,
 * or null if the caller may proceed.
 *
 * Behavior:
 *   - CRON_SECRET missing → 500 (server misconfiguration, refuse all requests)
 *   - Authorization header wrong or missing → 401
 *   - Correct Bearer token → null (authorized)
 */
export function requireCronAuth(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error("requireCronAuth: CRON_SECRET is not set — refusing request");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
