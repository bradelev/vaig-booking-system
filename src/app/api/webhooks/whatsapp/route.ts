import { NextRequest, NextResponse } from "next/server";

// GET — webhook verification (Meta challenge)
export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_WEBHOOK_SECRET
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST — incoming messages (stub)
export function POST() {
  // TODO: implement in VBS-2x
  // IMPORTANT: respond 200 immediately, process via waitUntil
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
