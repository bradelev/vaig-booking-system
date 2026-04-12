import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/backoffice/page-header";
import ConversationList from "./conversation-list";

export const metadata: Metadata = { title: "Inbox" };

interface InboxConversation {
  phone: string;
  handoff_active: boolean;
  handoff_at: string | null;
  last_inbound_at: string | null;
  bot_state: string;
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
  last_message_body: string | null;
  last_message_direction: string | null;
  last_message_at: string | null;
  unread_count: number;
}

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
