import { NextRequest, NextResponse } from "next/server";
import { invalidateKnowledgeCache } from "@/lib/bot/knowledge";
import { logger } from "@/lib/logger";
import { requireCronAuth } from "@/lib/auth/require-cron-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = requireCronAuth(request);
  if (authError) return authError as NextResponse;

  invalidateKnowledgeCache();

  logger.info("Knowledge base cache invalidated");

  return NextResponse.json({ invalidated: true, timestamp: new Date().toISOString() });
}
