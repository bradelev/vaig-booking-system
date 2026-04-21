import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString();

  const dbCheck = await Promise.race<string>([
    (async () => {
      try {
        const db = createAdminClient();
        const { error } = await db.from("system_config").select("key").limit(1);
        return error ? `error: ${error.message}` : "ok";
      } catch (err) {
        return `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    })(),
    new Promise<string>((resolve) =>
      setTimeout(() => resolve("error: timeout"), 3000)
    ),
  ]);

  const status = dbCheck === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    { status, timestamp, checks: { database: dbCheck } },
    { status: status === "ok" ? 200 : 503 }
  );
}
