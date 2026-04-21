import { NextRequest, NextResponse } from "next/server";
import { invalidateKnowledgeCache } from "@/lib/bot/knowledge";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  invalidateKnowledgeCache();

  logger.info("Knowledge base cache invalidated");

  return NextResponse.json({ invalidated: true, timestamp: new Date().toISOString() });
}
