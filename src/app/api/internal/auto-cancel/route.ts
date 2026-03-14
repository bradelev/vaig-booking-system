import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConfigValue } from "@/lib/config";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const autoHours = parseInt(await getConfigValue("auto_cancel_hours", "24"));
  const cutoff = new Date(Date.now() - autoHours * 3600_000).toISOString();

  const { data: expiredBookings, error: fetchError } = await client
    .from("bookings")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (fetchError) {
    console.error("[Auto-cancel] Failed to fetch expired bookings:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const ids = (expiredBookings ?? []).map((b: { id: string }) => b.id);

  if (ids.length === 0) {
    return NextResponse.json({ cancelled: 0 });
  }

  const { error: updateError } = await client
    .from("bookings")
    .update({ status: "cancelled" })
    .in("id", ids);

  if (updateError) {
    console.error("[Auto-cancel] Failed to cancel bookings:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  console.log(`[Auto-cancel] Cancelled ${ids.length} expired booking(s)`);
  return NextResponse.json({ cancelled: ids.length });
}
