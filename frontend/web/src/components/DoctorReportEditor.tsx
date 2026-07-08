"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  REPORT_SECTIONS,
  emptyReport,
  parseReportData,
  serializeReport,
  validateReport,
  type DoctorReportData,
} from "@/lib/doctorReport";
import { FormField } from "@/components/FormField";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Check,
  Cloud,
  CloudOff,
  Eye,
  FileEdit,
  FileText,
  Printer,
  Save,
  Send,
} from "lucide-react";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type Step = "edit" | "preview";

type Props = {
  applicationId: string;
  token: string;
  isConcluded: boolean;
  onConcluded?: () => void;
  onStepChange?: (step: Step) => void;
  onViewApplication?: () => void;
};

const LOCAL_KEY_PREFIX = "doctor-report-draft-";
const AUTO_SAVE_MS = 20_000;

export function DoctorReportEditor({
  applicationId,
  token,
  isConcluded,
  onConcluded,
  onStepChange,
  onViewApplication,
}: Props) {
  const [report, setReport] = useState<DoctorReportData>(emptyReport());
  const [step, setStep] = useState<Step>("edit");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const dirtyRef = useRef(false);
  const lastSavedRef = useRef("");

  const localKey = `${LOCAL_KEY_PREFIX}${applicationId}`;

  const validationErrors = useMemo(() => validateReport(report), [report]);

  const changeStep = (next: Step) => {
    setStep(next);
    onStepChange?.(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadReport = useCallback(async () => {
    if (isConcluded) {
      const final = await api<{ reportJson: unknown }>(
        API.applications.report(applicationId),
        {},
        token
      ).catch(() => null);
      if (final?.reportJson) {
        const parsed = parseReportData(final.reportJson);
        setReport(parsed);
        lastSavedRef.current = serializeReport(parsed);
        setLoaded(true);
        return;
      }
    }

    const draft = await api<{ data: string }>(
      API.applications.reportDraft(applicationId),
      {},
      token
    ).catch(() => ({ data: "{}" }));

    let serverData = emptyReport();
    const d = draft.data?.trim();
    if (d && d !== "{}") {
      serverData = parseReportData(d);
    }

    let localData: DoctorReportData | null = null;
    if (typeof window !== "undefined") {
      const local = localStorage.getItem(localKey);
      if (local) {
        try {
          const parsed = JSON.parse(local) as { data: DoctorReportData; savedAt: number };
          if (parsed.data && parsed.savedAt) localData = parsed.data;
        } catch {
          /* ignore */
        }
      }
    }

    const merged = localData && !isConcluded ? localData : serverData;
    setReport(merged);
    lastSavedRef.current = serializeReport(merged);
    setLoaded(true);
  }, [applicationId, token, isConcluded, localKey]);

  useEffect(() => {
    loadReport().catch(() => setError("Rapor yüklenemedi."));
  }, [loadReport]);

  const updateField = (key: keyof DoctorReportData, value: string) => {
    setReport((prev) => ({ ...prev, [key]: value }));
    dirtyRef.current = true;
    setSaveStatus("idle");
  };

  const saveDraft = useCallback(
    async (silent = false) => {
      if (isConcluded) return;
      const serialized = serializeReport(report);
      if (serialized === lastSavedRef.current) return;

      setSaveStatus("saving");
      try {
        await api(API.applications.reportDraft(applicationId), {
          method: "PUT",
          body: JSON.stringify({ data: serialized }),
        }, token);

        lastSavedRef.current = serialized;
        dirtyRef.current = false;
        setSaveStatus("saved");

        if (typeof window !== "undefined") {
          localStorage.setItem(
            localKey,
            JSON.stringify({ data: report, savedAt: Date.now() })
          );
        }

        if (!silent) {
          setMsg("Taslak sunucuya kaydedildi.");
          setTimeout(() => setMsg(""), 3000);
        }
      } catch (err) {
        setSaveStatus("error");
        if (!silent) {
          setError(err instanceof ApiError ? err.message : "Taslak kaydedilemedi.");
        }
      }
    },
    [applicationId, token, report, isConcluded, localKey]
  );

  useEffect(() => {
    if (!loaded || isConcluded) return;
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          localKey,
          JSON.stringify({ data: report, savedAt: Date.now() })
        );
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [report, loaded, isConcluded, localKey]);

  useEffect(() => {
    if (!loaded || isConcluded) return;
    const interval = setInterval(() => {
      if (dirtyRef.current) saveDraft(true);
    }, AUTO_SAVE_MS);
    return () => clearInterval(interval);
  }, [loaded, isConcluded, saveDraft]);

  function goToPreview() {
    const errors = validateReport(report);
    if (errors.length > 0) {
      setError(errors[0].message);
      const el = document.getElementById(`field-${errors[0].field}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError("");
    setPreviewLoading(true);
    setPreviewHtml("");
    changeStep("preview");

    fetchTextWithAuth(
      API.applications.reportPreview(applicationId),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportJson: serializeReport(report) }),
      },
      token
    )
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Önizleme yüklenemedi.");
        }
        return res.text();
      })
      .then((html) => setPreviewHtml(html))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Önizleme yüklenemedi.");
        changeStep("edit");
      })
      .finally(() => setPreviewLoading(false));
  }

  async function handleConclude() {
    const errors = validateReport(report);
    if (errors.length > 0) {
      setError(errors[0].message);
      changeStep("edit");
      setConfirmOpen(false);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const dataStr = serializeReport(report);
      if (isConcluded) {
        await api(API.applications.reportUpdate(applicationId), {
          method: "PUT",
          body: JSON.stringify({ reportJson: dataStr }),
        }, token);
        setMsg("Rapor başarıyla güncellendi.");
      } else {
        await api(API.applications.conclude(applicationId), {
          method: "POST",
          body: JSON.stringify({ reportJson: dataStr }),
        }, token);
        if (typeof window !== "undefined") {
          localStorage.removeItem(localKey);
        }
        setMsg("Rapor onaylandı ve hastaya iletildi.");
        onConcluded?.();
      }
      lastSavedRef.current = dataStr;
      dirtyRef.current = false;
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşlem başarısız.");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  function openPrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(previewHtml);
    w.document.close();
    w.focus();
    w.print();
  }

  if (!loaded) {
    return <div className="text-sm text-slate-500 py-8 text-center">Rapor yükleniyor...</div>;
  }

  const alerts = (
    <>
      {error ? (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-xl p-4 text-sm font-medium">
          {error}
        </div>
      ) : null}
      {msg ? (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-4 text-sm font-medium flex items-center gap-2">
          <Check className="h-4 w-4" />
          {msg}
        </div>
      ) : null}
    </>
  );

  const confirmModal = (
    <ConfirmModal
      isOpen={confirmOpen}
      title={isConcluded ? "Raporu Güncelle" : "Raporu Onayla ve Gönder"}
      message={
        isConcluded
          ? "Rapor güncellenecek. Hastaya yeni bildirim gönderilmeyecektir. Devam etmek istiyor musunuz?"
          : "Rapor hastaya iletilecek ve başvuru sonuçlandırılacak. Bu işlem geri alınamaz. Önizlemeyi kontrol ettiniz mi?"
      }
      confirmText={isConcluded ? "Evet, Güncelle" : "Evet, Gönder"}
      cancelText="Vazgeç"
      onConfirm={handleConclude}
      onCancel={() => setConfirmOpen(false)}
    />
  );

  /* ── ADIM 2: Önizleme — tamamen ayrı ekran ── */
  if (step === "preview") {
    return (
      <div className="flex flex-col gap-4">
        {alerts}

        <Card className="shadow-premium border-primary/20 bg-white border-2">
          <CardHeader className="bg-primary/[0.03] border-b py-5 px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-slate-800 font-bold flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Rapor Önizleme
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Resmi belge çıktısını kontrol edin. Hata varsa düzenlemeye dönün.
                </CardDescription>
              </div>
              {onViewApplication ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold rounded-lg"
                  onClick={onViewApplication}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Başvuru Formu
                </Button>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {previewLoading ? (
              <Skeleton className="h-[min(75vh,800px)] w-full rounded-xl" />
            ) : previewHtml ? (
              <iframe
                title="Rapor önizleme"
                srcDoc={previewHtml}
                className="w-full h-[min(75vh,800px)] rounded-xl border border-slate-200 bg-white"
                sandbox="allow-same-origin allow-modals"
              />
            ) : null}
          </CardContent>

          <CardFooter className="border-t pt-4 px-6 flex flex-wrap gap-3 justify-between bg-slate-50/50">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError("");
                changeStep("edit");
              }}
              className="gap-2 h-10 px-5 rounded-xl font-bold"
            >
              <ArrowLeft className="h-4 w-4" />
              Düzenlemeye Dön
            </Button>

            <div className="flex gap-2">
              {previewHtml ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={openPrint}
                  className="gap-2 h-10 px-5 rounded-xl font-bold"
                >
                  <Printer className="h-4 w-4" />
                  Yazdır / PDF
                </Button>
              ) : null}
              <Button
                disabled={busy || previewLoading || !previewHtml}
                onClick={() => setConfirmOpen(true)}
                className="gap-2 h-10 px-6 rounded-xl font-bold shadow-md shadow-primary/10"
              >
                {isConcluded ? (
                  <>
                    <Save className="h-4 w-4" />
                    Raporu Güncelle
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Raporu Onayla ve Gönder
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>

        {confirmModal}
      </div>
    );
  }

  /* ── ADIM 1: Rapor yazımı ── */
  return (
    <div className="flex flex-col gap-4">
      {alerts}

      <Card className="shadow-premium border-primary/10 bg-white border-2">
        <CardHeader className="bg-primary/[0.02] border-b py-4 px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base text-slate-800 font-bold flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-primary" />
                {isConcluded ? "Tıbbi Uzman Raporu — Düzenleme" : "Tıbbi Uzman Raporu"}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Tüm alanları yukarıdan aşağıya doldurun. Bitince önizleme adımına geçin.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onViewApplication ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold rounded-lg"
                  onClick={onViewApplication}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Başvuru Formu
                </Button>
              ) : null}
              {!isConcluded ? (
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold gap-1 ${
                  saveStatus === "saved"
                    ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                    : saveStatus === "error"
                      ? "border-red-300 text-red-700 bg-red-50"
                      : saveStatus === "saving"
                        ? "border-amber-300 text-amber-700 bg-amber-50"
                        : ""
                }`}
              >
                {saveStatus === "saved" ? (
                  <Cloud className="h-3 w-3" />
                ) : saveStatus === "error" ? (
                  <CloudOff className="h-3 w-3" />
                ) : (
                  <Cloud className="h-3 w-3" />
                )}
                {saveStatus === "saving"
                  ? "Kaydediliyor..."
                  : saveStatus === "saved"
                    ? "Taslak kaydedildi"
                    : saveStatus === "error"
                      ? "Kayıt hatası"
                      : "Otomatik kayıt aktif"}
              </Badge>
            ) : (
              <Badge variant="default" className="text-[10px]">
                Sonuçlandırılmış
              </Badge>
            )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="flex flex-col gap-8">
            {REPORT_SECTIONS.map((section, i) => (
              <div key={section.key} id={section.key} className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{section.label}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {section.hint}
                      {section.required ? " (Zorunlu)" : ""}
                    </p>
                  </div>
                </div>

                <FormField id={`field-${section.key}`} label="" hint="">
                  <Textarea
                    id={`field-${section.key}`}
                    placeholder={section.placeholder}
                    value={report[section.key]}
                    onChange={(e) => updateField(section.key, e.target.value)}
                    className="min-h-[160px] text-[15px] leading-relaxed focus-visible:ring-primary bg-white rounded-xl resize-y"
                    style={{ lineHeight: "1.75" }}
                  />
                </FormField>

                <div className="flex items-center justify-between text-xs text-slate-400 -mt-1">
                  <span>
                    {report[section.key].length} karakter
                    {section.minLength > 0 && section.required
                      ? ` (min. ${section.minLength})`
                      : ""}
                  </span>
                  {validationErrors.find((e) => e.field === section.key) ? (
                    <span className="text-red-500 font-medium">
                      {validationErrors.find((e) => e.field === section.key)?.message}
                    </span>
                  ) : report[section.key].trim() ? (
                    <span className="text-emerald-600 font-medium">Tamamlandı</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="border-t pt-4 px-6 flex flex-wrap gap-3 justify-between bg-slate-50/50">
          <div className="flex gap-2">
            {!isConcluded ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => saveDraft(false)}
                className="gap-2 h-10 px-5 rounded-xl font-bold"
              >
                <Save className="h-4 w-4" />
                Taslağı Kaydet
              </Button>
            ) : null}
          </div>
          <Button
            disabled={busy}
            onClick={goToPreview}
            className="gap-2 h-10 px-6 rounded-xl font-bold"
          >
            <Eye className="h-4 w-4" />
            Raporu Önizle
          </Button>
        </CardFooter>
      </Card>

      {confirmModal}
    </div>
  );
}
