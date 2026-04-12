export interface InboxConversation {
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

export interface ChatMessage {
  id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  source: string;
  status: string;
  created_at: string;
}
