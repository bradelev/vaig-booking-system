"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  source: string;
  status: string;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  bot: "Bot",
  campaign: "Campaña",
  cron_reminder: "Recordatorio",
  cron_survey: "Encuesta",
  cron_payment: "Pago",
  cron_next_session: "Próxima sesión",
  admin_manual: "Admin",
  admin_notification: "Notificación",
  client: "",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Clock className="h-3 w-3 text-muted-foreground/50" />;
    case "sent":
      return <Check className="h-3 w-3 text-muted-foreground/50" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-muted-foreground/50" />;
    case "read":
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";

  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].created_at).toDateString();
  const curr = new Date(messages[index].created_at).toDateString();
  return prev !== curr;
}

export default function ChatThread({
  initialMessages,
}: {
  initialMessages: Message[];
  phone: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [initialMessages.length]);

  if (initialMessages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No hay mensajes en esta conversación
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {initialMessages.map((msg, i) => (
        <div key={msg.id}>
          {/* Date separator */}
          {shouldShowDateSeparator(initialMessages, i) && (
            <div className="flex items-center justify-center py-2">
              <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                {formatDateSeparator(msg.created_at)}
              </span>
            </div>
          )}

          {/* Message bubble */}
          <div
            className={cn(
              "flex",
              msg.direction === "inbound" ? "justify-start" : "justify-end"
            )}
          >
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                msg.direction === "inbound"
                  ? "bg-muted text-foreground rounded-bl-md"
                  : "bg-primary text-primary-foreground rounded-br-md"
              )}
            >
              {/* Source badge for outbound */}
              {msg.direction === "outbound" && SOURCE_LABELS[msg.source] && (
                <span className="block text-[10px] font-medium opacity-70 mb-0.5">
                  {SOURCE_LABELS[msg.source]}
                </span>
              )}

              {/* Message body */}
              <p className="whitespace-pre-wrap break-words">
                {msg.body ?? <span className="italic opacity-60">[sin contenido]</span>}
              </p>

              {/* Time + status */}
              <div
                className={cn(
                  "mt-1 flex items-center justify-end gap-1",
                  msg.direction === "inbound"
                    ? "text-muted-foreground/60"
                    : "text-primary-foreground/60"
                )}
              >
                <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                {msg.direction === "outbound" && <StatusIcon status={msg.status} />}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
