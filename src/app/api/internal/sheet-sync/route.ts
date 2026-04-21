import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { syncSheetHistorico } from "@/lib/sheet-historico/import-engine";

/**
 * POST /api/internal/sheet-sync
 *
 * Syncs historical session data from Google Sheets "Ingresos pacientes"
 * into sesiones_historicas table.
 *
 * No request body required — the spreadsheet URL is hardcoded (public export).
 * Requires an authenticated backoffice session (Supabase session cookie).
 */
export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncSheetHistorico();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Sheet sync failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
