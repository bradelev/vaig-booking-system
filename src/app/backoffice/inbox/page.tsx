import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/backoffice/page-header";
import ConversationList from "./conversation-list";
import type { InboxConversation } from "./types";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conversations } = await (supabase as any)
    .from("inbox_conversations")
    .select("*");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        subtitle="Conversaciones de WhatsApp"
      />
      <ConversationList
        initialConversations={(conversations ?? []) as InboxConversation[]}
      />
    </div>
  );
}
