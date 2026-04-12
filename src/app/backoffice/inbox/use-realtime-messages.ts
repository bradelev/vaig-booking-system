"use client";

import { useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export interface RealtimeMessage {
  id: string;
  phone: string;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  source: string;
  status: string;
  created_at: string;
  admin_read_at: string | null;
}

type MessageHandler = (msg: RealtimeMessage) => void;

export function useRealtimeMessages(
  onInsert: MessageHandler,
  filter?: { phone?: string }
) {
  const handlerRef = useRef<MessageHandler>(onInsert);

  useEffect(() => {
    handlerRef.current = onInsert;
  });

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channelName = filter?.phone
      ? `messages:phone=${filter.phone}`
      : "messages:all";

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          ...(filter?.phone ? { filter: `phone=eq.${filter.phone}` } : {}),
        },
        (payload) => {
          handlerRef.current(payload.new as RealtimeMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter?.phone]);
}
