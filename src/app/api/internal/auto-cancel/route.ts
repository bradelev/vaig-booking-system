import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigValue } from "@/lib/config";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createAdminClient();

  const autoHours = parseInt(await getConfigValue("auto_cancel_hours", "24"));
  const cutoff = new Date(Date.now() - autoHours * 3600_000).toISOString();

  const { data: expiredBookings, error: fetchError } = await client
    .from("bookings")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (fetchError) {
    logger.error("Auto-cancel failed to fetch expired bookings", { error: fetchError.message });
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const ids = (expiredBookings ?? []).map((b) => (b as { id: string }).id);

  if (ids.length === 0) {
    return NextResponse.json({ cancelled: 0 });
  }

  const { error: updateError } = await client
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: "other",
      cancellation_note: "Auto-cancelado por vencimiento de plazo de pago",
      cancelled_by: "admin",
    })
    .in("id", ids);

  if (updateError) {
    logger.error("Auto-cancel failed to update bookings", { error: updateError.message });
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  logger.info("Auto-cancel completed", { cancelled: ids.length });
  return NextResponse.json({ cancelled: ids.length });
}
