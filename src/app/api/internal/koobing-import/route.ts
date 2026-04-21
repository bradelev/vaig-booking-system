import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { importKoobingAppointments } from "@/lib/koobing/import-engine";

/**
 * POST /api/internal/koobing-import
 *
 * Imports Koobing appointments as VAIG bookings.
 * Requires an authenticated backoffice session (Supabase session cookie).
 *
 * Default range: 2024-07-01 → today + 90 days (full history).
 * Accepts optional body: { from?: string; to?: string } (YYYY-MM-DD)
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let from: string | undefined;
    let to: string | undefined;

    try {
      const body = await request.json();
      from = body?.from;
      to = body?.to;
    } catch {
      // No body — use defaults
    }

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !DATE_RE.test(from)) {
      return NextResponse.json({ error: "Invalid from date (expected YYYY-MM-DD)" }, { status: 400 });
    }
    if (to && !DATE_RE.test(to)) {
      return NextResponse.json({ error: "Invalid to date (expected YYYY-MM-DD)" }, { status: 400 });
    }

    const ninetyDaysLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const result = await importKoobingAppointments({
      from: from ?? "2024-07-01",
      to: to ?? ninetyDaysLater,
      dryRun: false,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Koobing import failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
