"use client";

import { useEffect, useState } from "react";
import { fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  downloadHtmlDocument,
  openHtmlDocument,
  previewDownloadFilename,
  printHtmlDocumentSync,
} from "@/lib/documentPreview";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Printer } from "lucide-react";

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
  const [actionMsg, setActionMsg] = useState("");

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

  const filename = previewDownloadFilename("basvuru-formu", applicationId);

  function handleDownload() {
    if (!html) return;
    downloadHtmlDocument(html, filename);
    setActionMsg("Form indirildi. Dosyalar uygulamanızdan veya indirilenler klasöründen açılabilir.");
  }

  function handleOpenFullScreen() {
    if (!html) return;
    if (!openHtmlDocument(html)) {
      setActionMsg("Tarayıcı penceresi açılamadı. Lütfen «Formu indir» seçeneğini kullanın.");
      return;
    }
    setActionMsg("");
  }

  function handlePrint() {
    if (!html) return;
    if (!printHtmlDocumentSync(html)) {
      setActionMsg("Yazdırma penceresi açılamadı. Önce formu indirip cihazınızdan açmayı deneyin.");
    }
  }

  if (loading) {
    return (
      <>
        <Skeleton className="h-32 w-full rounded-lg md:hidden" />
        <Skeleton className="hidden h-[min(70vh,640px)] w-full rounded-lg md:block" />
      </>
    );
  }

  if (error) return <p className="text-destructive text-sm">{error}</p>;

  return (
    <div className="grid gap-3">
      {/* Mobil: iframe yok — indir / tam ekran */}
      <div className="md:hidden grid gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-foreground">Başvuru formunuz hazır</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Telefon ekranında form okunaklı değildir. Onaylamadan önce formu{" "}
              <strong className="font-medium text-foreground">indirin</strong> veya{" "}
              <strong className="font-medium text-foreground">tam ekranda açarak</strong> tüm bilgileri
              kontrol edin.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Button
            type="button"
            className="w-full min-h-11 gap-2 touch-manipulation"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            Formu indir
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-11 gap-2 touch-manipulation"
            onClick={handleOpenFullScreen}
          >
            <ExternalLink className="h-4 w-4" />
            Tam ekran aç
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full min-h-11 gap-2 touch-manipulation"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            PDF olarak kaydet
          </Button>
        </div>

        {actionMsg ? (
          <p className="text-xs text-muted-foreground rounded-lg border bg-background/80 px-3 py-2 leading-relaxed">
            {actionMsg}
          </p>
        ) : null}
      </div>

      {/* Masaüstü: gömülü önizleme */}
      <div className="hidden md:grid doc-preview-frame gap-3">
        <p className="text-muted-foreground text-sm">
          Hasta başvuru formunun resmi belge çıktısı aşağıdadır. PDF kaydetmek için &quot;Yazdır / PDF&quot;
          butonunu kullanın.
        </p>
        <iframe
          title="Başvuru önizleme"
          srcDoc={html}
          className="h-[min(70vh,640px)] w-full min-w-0 rounded-lg border bg-white"
          sandbox="allow-same-origin allow-modals"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start gap-2"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4" />
          Yazdır / PDF olarak kaydet
        </Button>
      </div>
    </div>
  );
}
