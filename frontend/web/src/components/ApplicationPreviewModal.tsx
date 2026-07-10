"use client";

import { useEffect, useState } from "react";
import { fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer } from "lucide-react";

type Props = {
  applicationId: string;
  token?: string;
  isOpen: boolean;
  onClose: () => void;
};

async function readPreviewError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await res.json()) as { responseMessage?: string };
      if (body.responseMessage) return body.responseMessage;
    } catch {
      /* ignore */
    }
  }
  return `Önizleme yüklenemedi. (${res.status})`;
}

export function ApplicationPreviewModal({ applicationId, token, isOpen, onClose }: Props) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    fetchTextWithAuth(API.applications.preview(applicationId), {}, token)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readPreviewError(res));
        return res.text();
      })
      .then((doc) => {
        if (!cancelled) setHtml(doc);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Önizleme yüklenemedi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, token, isOpen]);

  function openPrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left sm:px-6">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-base">Hasta Başvuru Formu</DialogTitle>
              <DialogDescription>Hastanın gönderdiği resmi başvuru belgesi</DialogDescription>
            </div>
            {html ? (
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={openPrint}>
                <Printer className="h-3.5 w-3.5" />
                Yazdır / PDF
              </Button>
            ) : null}
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3">
          {loading ? (
            <Skeleton className="h-full min-h-[50vh] w-full rounded-md" />
          ) : error ? (
            <p className="p-4 text-sm text-destructive">{error}</p>
          ) : (
            <iframe
              title="Hasta başvuru formu"
              srcDoc={html}
              className="h-[min(70vh,720px)] w-full rounded-md border bg-background"
              sandbox="allow-same-origin allow-modals"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
