import { NextResponse } from "next/server";

// GET — Supabase keep-alive cron (stub, see VBS-16 for full implementation)
export function GET() {
  // TODO: implement in VBS-16
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
