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

  const sessionDaysStr = await getConfigValue("session_retention_days", "30");
  const messageDaysStr = await getConfigValue("message_retention_days", "90");
  const sessionDays = parseInt(sessionDaysStr, 10);
  const messageDays = parseInt(messageDaysStr, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any;

  const sessionCutoff = new Date(Date.now() - sessionDays * 86_400_000).toISOString();
  const { data: deletedSessions, error: sessionError } = await client
    .from("conversation_sessions")
    .delete()
    .lt("updated_at", sessionCutoff)
    .eq("handoff_active", false)
    .select("id");

  if (sessionError) {
    logger.error("[Cleanup] Failed to delete sessions", { error: String(sessionError) });
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  const messageCutoff = new Date(Date.now() - messageDays * 86_400_000).toISOString();
  const { data: deletedMessages, error: messageError } = await client
    .from("messages")
    .delete()
    .lt("created_at", messageCutoff)
    .select("id");

  if (messageError) {
    logger.error("[Cleanup] Failed to delete messages", { error: String(messageError) });
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  const result = {
    deleted: {
      sessions: deletedSessions?.length ?? 0,
      messages: deletedMessages?.length ?? 0,
    },
    retentionDays: {
      sessions: sessionDays,
      messages: messageDays,
    },
  };

  logger.info("[Cleanup] Retention cleanup complete", {
    sessions: result.deleted.sessions,
    messages: result.deleted.messages,
  });

  return NextResponse.json(result);
}
