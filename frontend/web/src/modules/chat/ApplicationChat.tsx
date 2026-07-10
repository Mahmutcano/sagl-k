"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { wsBaseUrl } from "@/modules/chat/ws";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

export type ChatMessage = {
  id: string;
  applicationId: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  isMine?: boolean;
};

type Props = {
  applicationId: string;
  token: string;
  enabled?: boolean;
  className?: string;
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ApplicationChat({ applicationId, token, enabled = true, className }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadMessages = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return api<ChatMessage[]>(API.applications.messages(applicationId), {}, token)
      .then((list) => {
        setMessages(list ?? []);
        setTimeout(scrollToBottom, 50);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Mesajlar yüklenemedi.");
      });
  }, [applicationId, enabled, scrollToBottom, token]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
  }, [enabled, loadMessages]);

  useEffect(() => {
    if (!enabled || !token) return;

    const url = `${wsBaseUrl()}${API.applications.chatWs}?token=${encodeURIComponent(token)}&applicationId=${encodeURIComponent(applicationId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data) as { type?: string; data?: ChatMessage };
        if (payload.type === "message" && payload.data?.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.data!.id)) return prev;
            return [...prev, payload.data!];
          });
          setTimeout(scrollToBottom, 50);
        }
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [applicationId, enabled, scrollToBottom, token]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    try {
      const msg = await api<ChatMessage>(
        API.applications.messages(applicationId),
        { method: "POST", body: JSON.stringify({ content }) },
        token
      );
      setText("");
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  if (!enabled) return null;

  return (
    <div className={cn("flex min-h-[20rem] flex-col overflow-hidden rounded-xl border bg-card shadow-sm", className)}>
      <div className="border-b bg-muted/30 px-4 py-3">
        <h3 className="text-sm font-semibold">Mesajlaşma</h3>
        <p className="text-muted-foreground text-xs">Uzman hekiminizle güvenli yazışma</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#e8edf3]/40 px-3 py-4 sm:px-4">
        {loading ? (
          <p className="text-muted-foreground text-center text-sm">Mesajlar yükleniyor...</p>
        ) : messages.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            Henüz mesaj yok. İlk mesajı siz gönderebilirsiniz.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.isMine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                  m.isMine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border bg-white text-foreground"
                )}
              >
                {!m.isMine ? (
                  <p className="mb-1 text-[11px] font-semibold opacity-80">{m.senderName || "Doktor"}</p>
                ) : null}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px] text-right opacity-70",
                    m.isMine ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-4 text-xs text-destructive">{error}</p> : null}

      <form onSubmit={sendMessage} className="flex gap-2 border-t bg-background p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mesajınızı yazın..."
          rows={2}
          className="min-h-0 resize-none text-base sm:text-sm"
          maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(e);
            }
          }}
        />
        <Button type="submit" size="icon" className="shrink-0 self-end" disabled={sending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
