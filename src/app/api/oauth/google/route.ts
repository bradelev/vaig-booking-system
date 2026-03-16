/**
 * VBS-41 — Inicia el flujo OAuth de Google Calendar para un profesional.
 * GET /api/oauth/google?professionalId=<uuid>
 * Redirige al consentimiento de Google.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gcal";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const professionalId = request.nextUrl.searchParams.get("professionalId");
  if (!professionalId) {
    return NextResponse.json({ error: "professionalId required" }, { status: 400 });
  }

  const url = getAuthUrl(professionalId);
  return NextResponse.redirect(url);
}
