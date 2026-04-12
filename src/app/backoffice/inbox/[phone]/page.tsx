import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/bot/session";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChatThread from "./chat-thread";
import ReplyBox from "./reply-box";
import MarkAsRead from "./mark-as-read";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export const metadata: Metadata = { title: "Chat" };

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  source: string;
  status: string;
  created_at: string;
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;
  const decodedPhone = decodeURIComponent(phone);

  const supabase = await createClient();

  // Fetch messages for this phone
  const { data: messages } = await (supabase as AnyClient)
    .from("messages")
    .select("id, direction, message_type, body, source, status, created_at")
    .eq("phone", decodedPhone)
    .order("created_at", { ascending: true });

  // Fetch session for handoff state
  const session = await getSession(decodedPhone);

  // Resolve client name
  const { data: client } = await (supabase as AnyClient)
    .from("clients")
    .select("first_name, last_name")
    .eq("phone", decodedPhone)
    .maybeSingle();

  const displayName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(" ")
    : decodedPhone;

  // Check 24h window
  const lastInbound = session?.lastInboundAt;
  const now = new Date();
  const windowExpired = lastInbound
    ? now.getTime() - lastInbound.getTime() > 24 * 60 * 60 * 1000
    : true;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          href="/backoffice/inbox"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {displayName}
          </h2>
          <p className="text-xs text-muted-foreground">{decodedPhone}</p>
        </div>
        {session?.handoffActive && (
          <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
            Handoff activo
          </span>
        )}
      </div>

      {/* Messages */}
      <ChatThread
        initialMessages={(messages ?? []) as Message[]}
        phone={decodedPhone}
      />

      {/* Reply box */}
      <ReplyBox
        phone={decodedPhone}
        handoffActive={session?.handoffActive ?? false}
        windowExpired={windowExpired}
      />

      {/* Mark messages as read on mount */}
      <MarkAsRead phone={decodedPhone} />
    </div>
  );
}
