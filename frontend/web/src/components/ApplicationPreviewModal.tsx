"use client";

import { useEffect, useState } from "react";
import { fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, X } from "lucide-react";

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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  function openPrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-xl border bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-slate-50 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Hasta Başvuru Formu</h3>
            <p className="text-xs text-slate-500">Hastanın gönderdiği resmi başvuru belgesi</p>
          </div>
          <div className="flex items-center gap-2">
            {html ? (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={openPrint}>
                <Printer className="h-3.5 w-3.5" />
                Yazdır / PDF
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-3 bg-slate-100">
          {loading ? (
            <Skeleton className="h-full min-h-[60vh] w-full rounded-lg" />
          ) : error ? (
            <p className="text-destructive text-sm p-4">{error}</p>
          ) : (
            <iframe
              title="Hasta başvuru formu"
              srcDoc={html}
              className="w-full h-[min(75vh,720px)] rounded-lg border bg-white"
              sandbox="allow-same-origin allow-modals"
            />
          )}
        </div>
      </div>
    </div>
  );
}
