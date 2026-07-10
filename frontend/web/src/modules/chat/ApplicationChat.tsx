"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { wsBaseUrl } from "@/modules/chat/ws";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <Card className={cn("flex min-h-[20rem] flex-col overflow-hidden", className)}>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Mesajlaşma</CardTitle>
        <CardDescription>Uzman hekiminizle güvenli yazışma</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[16rem] px-3 sm:h-[18rem] sm:px-4">
          <div className="space-y-3 py-4">
            {loading ? (
              <p className="text-center text-sm text-muted-foreground">Mesajlar yükleniyor...</p>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
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
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      m.isMine
                        ? "bg-primary text-primary-foreground"
                        : "border bg-muted"
                    )}
                  >
                    {!m.isMine ? (
                      <p className="mb-1 text-[11px] font-medium opacity-80">
                        {m.senderName || "Doktor"}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-right text-[10px] opacity-70",
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
        </ScrollArea>
        {error ? <p className="px-4 pb-2 text-xs text-destructive">{error}</p> : null}
      </CardContent>
      <CardFooter className="border-t p-3">
        <form onSubmit={sendMessage} className="flex w-full gap-2">
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
      </CardFooter>
    </Card>
  );
}
