import { NextResponse } from "next/server";
import { importGCalEvents } from "@/lib/gcal/import-engine";

/**
 * POST /api/internal/gcal-import
 *
 * Imports Google Calendar events as bookings (status: deposit_paid).
 * Events already linked to a booking (via gcal_event_id) are skipped.
 *
 * Default range: last 30 days + next 30 days.
 * Accepts optional body: { timeMin?: string; timeMax?: string }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    let timeMin: string | undefined;
    let timeMax: string | undefined;

    try {
      const body = await request.json();
      timeMin = body?.timeMin;
      timeMax = body?.timeMax;
    } catch {
      // No body or invalid JSON — use defaults
    }

    const now = new Date();
    const resolvedTimeMin =
      timeMin ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const resolvedTimeMax =
      timeMax ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const result = await importGCalEvents({
      timeMin: resolvedTimeMin,
      timeMax: resolvedTimeMax,
      dryRun: false,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GCal Import] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
