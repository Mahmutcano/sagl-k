"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { REPORT_SECTIONS, parseReportData } from "@/lib/doctorReport";
import type { FinalReport } from "@/lib/application";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Printer } from "lucide-react";

type Props = {
  applicationId: string;
  token: string;
  report: FinalReport | null;
  reportLoading?: boolean;
};

function buildFallbackHtml(report: FinalReport): string {
  const parsed = parseReportData(report.reportJson);
  const sections = REPORT_SECTIONS.filter((s) => parsed[s.key]?.trim());
  const body = sections
    .map(
      (s) =>
        `<section style="margin-bottom:1.5rem"><h3 style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin:0 0 0.5rem">${s.label}</h3><p style="margin:0;white-space:pre-wrap;line-height:1.6">${parsed[s.key]}</p></section>`
    )
    .join("");
  const date = report.createdAt
    ? new Date(report.createdAt).toLocaleString("tr-TR")
    : "";
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Tıbbi Uzman Raporu</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;max-width:720px;margin:0 auto;color:#0f172a"><header style="border-bottom:2px solid #0ea5e9;padding-bottom:1rem;margin-bottom:1.5rem"><h1 style="margin:0;font-size:1.25rem">Tıbbi Uzman Raporu</h1>${date ? `<p style="margin:0.5rem 0 0;color:#64748b;font-size:0.875rem">Yayın tarihi: ${date}</p>` : ""}</header>${body}</body></html>`;
}

export function PatientReportPanel({ applicationId, token, report, reportLoading }: Props) {
  const [html, setHtml] = useState("");
  const [htmlLoading, setHtmlLoading] = useState(true);
  const [htmlError, setHtmlError] = useState("");

  const parsed = report?.reportJson ? parseReportData(report.reportJson) : null;
  const hasSectionText = parsed
    ? REPORT_SECTIONS.some((s) => parsed[s.key]?.trim())
    : false;

  const displayHtml = useMemo(() => {
    if (html) return html;
    if (report && hasSectionText) return buildFallbackHtml(report);
    return "";
  }, [html, report, hasSectionText]);

  const [blobUrl, setBlobUrl] = useState("");

  useEffect(() => {
    if (!displayHtml) {
      setBlobUrl("");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([displayHtml], { type: "text/html;charset=utf-8" })
    );
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [displayHtml]);

  useEffect(() => {
    let cancelled = false;
    setHtmlLoading(true);
    setHtmlError("");

    fetchTextWithAuth(API.applications.reportHtml(applicationId), {}, token)
      .then(async (res) => {
        if (!res.ok) {
          const msg =
            res.status === 404
              ? "Resmi rapor belgesi henüz hazır değil."
              : `Rapor yüklenemedi. (${res.status})`;
          throw new Error(msg);
        }
        return res.text();
      })
      .then((doc) => {
        if (!cancelled) setHtml(doc);
      })
      .catch((err) => {
        if (!cancelled) {
          setHtmlError(err instanceof Error ? err.message : "Rapor yüklenemedi.");
        }
      })
      .finally(() => {
        if (!cancelled) setHtmlLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, token]);

  function openPrint() {
    if (!displayHtml) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(displayHtml);
    w.document.close();
    w.focus();
    w.print();
  }

  const createdLabel = report?.createdAt
    ? new Date(report.createdAt).toLocaleString("tr-TR")
    : null;

  if (reportLoading || htmlLoading) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[min(70vh,640px)] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!displayHtml && !hasSectionText) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-base">Tıbbi uzman raporu</CardTitle>
          <CardDescription>
            {htmlError || "Rapor henüz yayınlanmadı. Doktorunuz raporu tamamladığında burada görüntüleyebilirsiniz."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 shadow-md overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Tıbbi Uzman Raporunuz
            </CardTitle>
            <CardDescription>
              {createdLabel
                ? `Yayın tarihi: ${createdLabel}`
                : "Başvurunuz sonuçlandırıldı."}
              {htmlError && hasSectionText
                ? " Resmi belge önizlemesi yüklenemedi; rapor metni aşağıda gösteriliyor."
                : null}
            </CardDescription>
          </div>
          <Badge>Onaylandı</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 bg-background">
            <p className="text-sm text-muted-foreground">
              Yazdır butonu ile raporu PDF olarak kaydedebilirsiniz.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={openPrint} className="gap-1.5 shrink-0">
              <Printer className="h-4 w-4" />
              Yazdır / PDF kaydet
            </Button>
          </div>
          {blobUrl ? (
            <iframe
              title="Tıbbi uzman raporu"
              src={blobUrl}
              className="w-full min-h-[min(75vh,720px)] border-0 bg-white"
              sandbox="allow-same-origin allow-modals"
            />
          ) : hasSectionText && parsed ? (
            <div className="p-6 space-y-5">
              {REPORT_SECTIONS.map((section) =>
                parsed[section.key]?.trim() ? (
                  <div key={section.key} className="space-y-1.5 border-l-4 border-primary pl-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {section.label}
                    </h4>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{parsed[section.key]}</p>
                  </div>
                ) : null
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
