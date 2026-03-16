/**
 * VBS-41 — Callback OAuth de Google Calendar.
 * Google redirige aquí con ?code=...&state=<professionalId>
 * Intercambia el code por tokens y los guarda en la DB.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/gcal";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const professionalId = searchParams.get("state");
  const error = searchParams.get("error");

  const backofficeUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/backoffice/profesionales/${professionalId}/editar`;

  if (error || !code || !professionalId) {
    console.error("[GCal OAuth] callback error:", error);
    return NextResponse.redirect(`${backofficeUrl}?gcal=error`);
  }

  try {
    const { refreshToken } = await exchangeCodeForTokens(code);

    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;

    await client
      .from("professionals")
      .update({
        google_refresh_token: refreshToken,
        google_calendar_id: "primary",
      })
      .eq("id", professionalId);

    return NextResponse.redirect(`${backofficeUrl}?gcal=connected`);
  } catch (err) {
    console.error("[GCal OAuth] token exchange failed:", err);
    return NextResponse.redirect(`${backofficeUrl}?gcal=error`);
  }
}
