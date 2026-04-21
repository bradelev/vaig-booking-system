import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/backoffice/page-header";
import ConversationList from "./conversation-list";
import type { InboxConversation } from "./types";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("inbox_conversations")
    .select("*");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        subtitle="Conversaciones de WhatsApp"
      />
      <ConversationList
        initialConversations={(conversations ?? []) as unknown as InboxConversation[]}
      />
    </div>
  );
}
