"use client";

import { useEffect, useState } from "react";
import { fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type Props = {
  applicationId: string;
  token?: string;
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
  if (res.status === 404) {
    return "Önizleme servisi bulunamadı. Backend yeniden başlatılmalı olabilir.";
  }
  return `Önizleme yüklenemedi. (${res.status})`;
}

export function ApplicationPreviewPanel({ applicationId, token }: Props) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
  }, [applicationId, token]);

  function openPrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  if (loading) return <Skeleton className="h-[min(70vh,640px)] w-full rounded-lg" />;
  if (error) return <p className="text-destructive text-sm">{error}</p>;

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">
        Hasta başvuru formunun resmi belge çıktısı aşağıdadır. PDF kaydetmek için &quot;Yazdır / PDF&quot; butonunu
        kullanın.
      </p>
      <iframe
        title="Başvuru önizleme"
        srcDoc={html}
        className="h-[min(70vh,640px)] w-full rounded-lg border bg-white"
        sandbox="allow-same-origin allow-modals"
      />
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={openPrint}>
        Yazdır / PDF olarak kaydet
      </Button>
    </div>
  );
}
