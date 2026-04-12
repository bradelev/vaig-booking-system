"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MessageSquare, User, Search } from "lucide-react";
import type { InboxConversation } from "./types";
import { useRealtimeMessages } from "./use-realtime-messages";

type Filter = "all" | "unread" | "handoff";

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Sin leer" },
  { value: "handoff", label: "Handoff" },
];

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function getDisplayName(conv: InboxConversation): string {
  if (conv.first_name || conv.last_name) {
    return [conv.first_name, conv.last_name].filter(Boolean).join(" ");
  }
  return conv.phone;
}

export default function ConversationList({
  initialConversations,
}: {
  initialConversations: InboxConversation[];
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState<InboxConversation[]>(initialConversations);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useRealtimeMessages((newMsg) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.phone === newMsg.phone);
      if (idx === -1) {
        // New conversation not in list — fetch updated view data
        router.refresh();
        return prev;
      }
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        last_message_body: newMsg.body,
        last_message_direction: newMsg.direction,
        last_message_at: newMsg.created_at,
        unread_count:
          newMsg.direction === "inbound"
            ? updated[idx].unread_count + 1
            : updated[idx].unread_count,
      };
      // Re-sort by last_message_at descending
      updated.sort(
        (a, b) =>
          new Date(b.last_message_at ?? 0).getTime() -
          new Date(a.last_message_at ?? 0).getTime()
      );
      return updated;
    });
  });

  const filtered = conversations.filter((conv) => {
    if (filter === "unread" && conv.unread_count === 0) return false;
    if (filter === "handoff" && !conv.handoff_active) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = getDisplayName(conv).toLowerCase();
      return name.includes(q) || conv.phone.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.label}
              {opt.value === "unread" && (
                <span className="ml-1 text-xs">
                  ({conversations.filter((c) => c.unread_count > 0).length})
                </span>
              )}
              {opt.value === "handoff" && (
                <span className="ml-1 text-xs">
                  ({conversations.filter((c) => c.handoff_active).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversation list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search ? "Sin resultados para esta búsqueda" : "No hay conversaciones"}
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {filtered.map((conv) => (
            <Link
              key={conv.phone}
              href={`/backoffice/inbox/${encodeURIComponent(conv.phone)}`}
              className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              {/* Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    "truncate text-sm",
                    conv.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground"
                  )}>
                    {getDisplayName(conv)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="truncate text-xs text-muted-foreground">
                    {conv.last_message_direction === "outbound" && (
                      <span className="text-muted-foreground/70">Tú: </span>
                    )}
                    {conv.last_message_body ?? "Sin mensajes"}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {conv.handoff_active && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Handoff
                      </Badge>
                    )}
                    {conv.unread_count > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
