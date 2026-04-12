"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Hand, Bot, AlertTriangle } from "lucide-react";
import {
  sendAdminReply,
  activateHandoffAction,
  releaseHandoffAction,
} from "./actions";

interface ReplyBoxProps {
  phone: string;
  handoffActive: boolean;
  windowExpired: boolean;
}

export default function ReplyBox({
  phone,
  handoffActive,
  windowExpired,
}: ReplyBoxProps) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSend() {
    if (!body.trim() || isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await sendAdminReply(phone, body);
      if (result.success) {
        setBody("");
        router.refresh();
      } else {
        setError(result.error ?? "Error al enviar");
      }
    });
  }

  function handleHandoff() {
    startTransition(async () => {
      if (handoffActive) {
        await releaseHandoffAction(phone);
      } else {
        await activateHandoffAction(phone);
      }
      router.refresh();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t bg-card">
      {/* 24h window warning */}
      {windowExpired && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            La ventana de 24h expiró. Solo podés enviar mensajes de plantilla.
          </span>
        </div>
      )}

      {/* Handoff control */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {handoffActive
            ? "Handoff activo — el bot no responde"
            : "Bot activo — respondiendo automáticamente"}
        </span>
        <Button
          variant={handoffActive ? "outline" : "destructive"}
          size="sm"
          onClick={handleHandoff}
          disabled={isPending}
          className="h-7 text-xs"
        >
          {handoffActive ? (
            <>
              <Bot className="mr-1.5 h-3 w-3" />
              Devolver al bot
            </>
          ) : (
            <>
              <Hand className="mr-1.5 h-3 w-3" />
              Tomar conversación
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-1.5 text-xs text-destructive">{error}</div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí un mensaje..."
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none"
          disabled={isPending}
        />
        <Button
          onClick={handleSend}
          disabled={!body.trim() || isPending}
          size="icon"
          className="h-10 w-10 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
