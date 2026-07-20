"use client";

import { ROUTES } from "@/lib/routes";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken, getUser, isAdminRole, clearAuth, fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { STATUS_LABELS, statusVariant, type ApplicationHistoryResponse, type ApplicationTimelineEvent, type ApplicationDetail } from "@/lib/application";
import { parseSurveyData, type ApplicationSurveyAnswers } from "@/lib/applicationSurvey";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, FormField, FormSelect, BirthDateSelect, TextInput } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApplicationCatalog } from "@/hooks/useApplicationCatalog";
import { FileText } from "lucide-react";

function formatWhen(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function timelineBadge(type: string) {
  if (type === "payment_paid" || type === "final_report") return "default" as const;
  if (type === "doctor_opened" || type === "report_viewed") return "secondary" as const;
  if (type.startsWith("draft")) return "outline" as const;
  return "secondary" as const;
}

export default function AdminApplicationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [timeline, setTimeline] = useState<ApplicationTimelineEvent[]>([]);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  // Edit fields
  const [status, setStatus] = useState<number>(0);
  const [professionCode, setProfessionCode] = useState("");
  const [careProviderId, setCareProviderId] = useState("");
  
  const [survey, setSurvey] = useState<ApplicationSurveyAnswers>({
    chiefComplaint: "",
    medicalHistory: "",
    currentMedications: "",
    previousDiagnosis: "",
    questionsForDoctor: "",
    additionalNotes: "",
  });

  const [isForRelative, setIsForRelative] = useState(false);
  const [relative, setRelative] = useState({
    firstName: "",
    lastName: "",
    nationalIdentifier: "",
    birthDate: "",
    gender: 0,
  });

  const [draftReport, setDraftReport] = useState<string | null>(null);
  const [finalReport, setFinalReport] = useState<{ reportJson: unknown; createdAt: string } | null>(null);
  const [attachments, setAttachments] = useState<{ id: string; fileName: string; mimeType: string; fileSize: number }[]>([]);
  const [payments, setPayments] = useState<{
    id: string;
    applicationId?: string;
    amount: number;
    currency: string;
    status: string;
    provider?: string;
    merchantOid?: string;
    orderStatus?: string;
    invoiceNumber?: string;
    invoiceStatus?: string;
    invoiceError?: string;
    callbackStatus?: string;
    createdAt?: string;
    paidAt?: string;
  }[]>([]);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Record<string, unknown> | null>(null);

  const catalog = useApplicationCatalog(1, professionCode, true);

  const loadData = useCallback(async (token: string) => {
    try {
      const histData = await api<ApplicationHistoryResponse | ApplicationTimelineEvent[]>(
        API.admin.applicationHistory(params.id),
        {},
        token
      );
      if (Array.isArray(histData)) {
        setTimeline(histData as ApplicationTimelineEvent[]);
      } else {
        setTimeline(histData.events ?? histData.statusHistory ?? []);
      }

      const appData = await api<ApplicationDetail>(API.applications.detail(params.id), {}, token);
      setStatus(appData.statusCode);
      setProfessionCode(appData.professionCode || "");
      setCareProviderId(appData.careProviderId || "");
      setIsForRelative(!!appData.isForRelative);

      if (appData.surveyData) {
        const parsed = parseSurveyData(appData.surveyData);
        setSurvey(parsed);
      }

      if (appData.representedPerson) {
        setRelative({
          firstName: appData.representedPerson.firstName || "",
          lastName: appData.representedPerson.lastName || "",
          nationalIdentifier: appData.representedPerson.nationalIdentifier || "",
          birthDate: appData.representedPerson.birthDate || "",
          gender: appData.representedPerson.gender || 0,
        });
      }

      // Load draft report if it exists
      api<{ data?: string }>(API.applications.reportDraft(params.id), {}, token)
        .then((draft) => {
          if (draft && draft.data && draft.data !== "{}") {
            setDraftReport(draft.data);
          } else {
            setDraftReport(null);
          }
        })
        .catch(() => setDraftReport(null));

      // Load final report if it exists
      api<{ reportJson: unknown; createdAt: string }>(API.applications.report(params.id), {}, token)
        .then((final) => {
          if (final && final.reportJson) {
            setFinalReport(final);
          } else {
            setFinalReport(null);
          }
        })
        .catch(() => setFinalReport(null));

      // Load attachments
      api<{ id: string; fileName: string; mimeType: string; fileSize: number }[]>(
        API.applications.attachments(params.id),
        {},
        token
      )
        .then((files) => setAttachments(files ?? []))
        .catch(() => setAttachments([]));

      // Payment / order / invoice report for this application
      api<{ items: typeof payments }>(
        `${API.admin.payments}?page=0&pageSize=50&search=${encodeURIComponent(params.id)}`,
        {},
        token
      )
        .then((res) =>
          setPayments((res?.items ?? []).filter((p) => p.applicationId === params.id))
        )
        .catch(() => setPayments([]));

    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace(ROUTES.admin.login);
      return;
    }
    loadData(token);
  }, [params.id, router, loadData]);

  async function handleAdminSave(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api(
        `/api/v1/admin/applications/${params.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            statusCode: status,
            professionCode,
            careProviderId: careProviderId || "",
            chiefComplaint: survey.chiefComplaint,
            medicalHistory: survey.medicalHistory,
            currentMedications: survey.currentMedications,
            previousDiagnosis: survey.previousDiagnosis,
            questionsForDoctor: survey.questionsForDoctor,
            additionalNotes: survey.additionalNotes,
            isForRelative,
            repFirstName: relative.firstName,
            repLastName: relative.lastName,
            repNationalIdentifier: relative.nationalIdentifier,
            repBirthDate: relative.birthDate,
            repGender: relative.gender,
          }),
        },
        token
      );

      setSuccess("Başvuru detayları yönetici tarafından başarıyla güncellendi.");
      loadData(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Değişiklikler kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const professionOptions = catalog.professions.map((p) => ({
    value: p.code,
    label: p.name,
  }));

  const providerOptions = catalog.providers.map((p) => ({
    value: p.careProviderId,
    label: p.title ? `${p.title} ${p.fullName}` : p.fullName,
  }));

  async function handleOpenAttachment(attachmentId: string, fileName: string, mimeType: string) {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetchTextWithAuth(API.applications.attachment(params.id, attachmentId), {}, token);
      if (!res.ok) throw new Error("Dosya indirilemedi.");
      const blob = await res.blob();
      const file = new Blob([blob], { type: mimeType });
      const url = window.URL.createObjectURL(file);
      window.open(url, "_blank");
    } catch {
      setError("Dosya açılamadı.");
    }
  }

  return (
    <AdminAppShell title="Başvuru Yönetimi ve Geçmişi" description={params.id}>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={ROUTES.admin.home}>← Özete dön</Link>
        </Button>
        <span className="text-xs text-muted-foreground font-mono">ID: {params.id}</span>
      </div>

      {error ? <FormAlert title="Hata" message={error} /> : null}
      {success ? (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg p-4 text-sm font-medium mb-6">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Left Column: Form Editor (takes 2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className=" ">
              <form onSubmit={handleAdminSave} noValidate>
                <CardHeader>
                  <CardTitle>Başvuru Bilgilerini Düzenle</CardTitle>
                  <CardDescription>
                    Yönetici olarak bu başvurunun tüm şikayet, bölüm, hekim ve hasta (veya yakın) bilgilerini direkt güncelleyebilirsiniz.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Operasyonel Durum & Hekim Atama</h4>
                    <div className="grid gap-6 sm:grid-cols-3 bg-muted/60 border /50 rounded-2xl p-5 shadow-sm">
                      <FormSelect
                        id="status-select"
                        label="Başvuru Durumu"
                        value={String(status)}
                        onChange={(e) => setStatus(Number(e.target.value))}
                        options={Object.entries(STATUS_LABELS).map(([code, label]) => ({
                          value: code,
                          label: label,
                        }))}
                      />
                      <FormSelect
                        id="profession-select"
                        label="Tıbbi Bölüm"
                        value={professionCode}
                        onChange={(e) => {
                          setProfessionCode(e.target.value);
                          setCareProviderId("");
                        }}
                        options={professionOptions}
                        placeholder="Bölüm seçiniz"
                      />
                      <FormSelect
                        id="provider-select"
                        label="Atanan Hekim"
                        value={careProviderId}
                        onChange={(e) => setCareProviderId(e.target.value)}
                        options={providerOptions}
                        placeholder={professionCode ? "Seçilmemiş (Kuyrukta)" : "Önce bölüm seçin"}
                        disabled={!professionCode}
                      />
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold border-b pb-1 pt-2 text-primary">Tıbbi Şikayet Detayları</h4>
                  <div className="grid gap-4">
                    <FormField id="chiefComplaint" label="Başvuru Nedeni / Şikayet">
                      <textarea
                        id="chiefComplaint"
                        rows={3}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={survey.chiefComplaint}
                        onChange={(e) => setSurvey(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                      />
                    </FormField>
                    <FormField id="medicalHistory" label="Tıbbi Öykü">
                      <textarea
                        id="medicalHistory"
                        rows={3}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={survey.medicalHistory}
                        onChange={(e) => setSurvey(prev => ({ ...prev, medicalHistory: e.target.value }))}
                      />
                    </FormField>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField id="currentMedications" label="Kullandığı İlaçlar">
                        <textarea
                          id="currentMedications"
                          rows={2}
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={survey.currentMedications}
                          onChange={(e) => setSurvey(prev => ({ ...prev, currentMedications: e.target.value }))}
                        />
                      </FormField>
                      <FormField id="previousDiagnosis" label="Önceki Tanı ve Tedaviler">
                        <textarea
                          id="previousDiagnosis"
                          rows={2}
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={survey.previousDiagnosis}
                          onChange={(e) => setSurvey(prev => ({ ...prev, previousDiagnosis: e.target.value }))}
                        />
                      </FormField>
                    </div>
                    <FormField id="questionsForDoctor" label="Doktora Sorular">
                      <textarea
                        id="questionsForDoctor"
                        rows={3}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={survey.questionsForDoctor}
                        onChange={(e) => setSurvey(prev => ({ ...prev, questionsForDoctor: e.target.value }))}
                      />
                    </FormField>
                    <FormField id="additionalNotes" label="Ek Açıklama">
                      <textarea
                        id="additionalNotes"
                        rows={2}
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={survey.additionalNotes}
                        onChange={(e) => setSurvey(prev => ({ ...prev, additionalNotes: e.target.value }))}
                      />
                    </FormField>
                  </div>

                  <h4 className="text-sm font-semibold border-b pb-1 pt-2 text-primary">Temsil Edilen Kişi (Yakın) Bilgileri</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="isForRelative"
                      className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      checked={isForRelative}
                      onChange={(e) => setIsForRelative(e.target.checked)}
                    />
                    <label htmlFor="isForRelative" className="text-sm font-semibold cursor-pointer select-none">
                      Bu başvuru bir yakın adına yapılmıştır
                    </label>
                  </div>

                  {isForRelative ? (
                    <div className="grid gap-4 sm:grid-cols-2 p-3 bg-muted/20 border rounded-lg">
                      <TextInput
                        id="rep-firstName"
                        label="Yakının Adı"
                        value={relative.firstName}
                        onChange={(e) => setRelative(prev => ({ ...prev, firstName: e.target.value }))}
                      />
                      <TextInput
                        id="rep-lastName"
                        label="Yakının Soyadı"
                        value={relative.lastName}
                        onChange={(e) => setRelative(prev => ({ ...prev, lastName: e.target.value }))}
                      />
                      <TextInput
                        id="rep-nationalIdentifier"
                        label="Yakının T.C. Kimlik No"
                        value={relative.nationalIdentifier}
                        onChange={(e) => setRelative(prev => ({ ...prev, nationalIdentifier: e.target.value }))}
                      />
                      <FormSelect
                        id="rep-gender"
                        label="Yakının Cinsiyeti"
                        value={relative.gender ? String(relative.gender) : ""}
                        onChange={(e) => setRelative(prev => ({ ...prev, gender: Number(e.target.value) }))}
                        placeholder="Cinsiyet Seçiniz"
                        options={[
                          { value: "1", label: "Erkek" },
                          { value: "2", label: "Kadın" },
                        ]}
                      />
                      <BirthDateSelect
                        value={relative.birthDate}
                        onChange={(iso) => setRelative(prev => ({ ...prev, birthDate: iso }))}
                        fieldClassName="sm:col-span-2"
                      />
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="border-t flex justify-end gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Kaydediliyor..." : "Başvuruyu Güncelle"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* Doctor Reports Card */}
            {(draftReport || finalReport) && (
              <Card className=" ">
                <CardHeader>
                  <CardTitle className="text-base text-primary">Uzman Hekim Raporları</CardTitle>
                  <CardDescription>
                    Hekim tarafından hazırlanan taslak veya onaylanmış tıbbi görüş raporları.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {finalReport && (
                    <div className="border border-emerald-100 bg-emerald-50/20 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <Badge variant="default" className="bg-emerald-600">Onaylanmış Nihai Rapor</Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(finalReport.createdAt).toLocaleString("tr-TR")}
                        </span>
                      </div>
                      <div className="text-sm bg-white border rounded-md p-3 whitespace-pre-wrap font-sans text-foreground">
                        {typeof finalReport.reportJson === "string" 
                          ? finalReport.reportJson 
                          : (finalReport.reportJson as Record<string, unknown>)?.conclusion 
                            ? String((finalReport.reportJson as Record<string, unknown>).conclusion)
                            : JSON.stringify(finalReport.reportJson, null, 2)}
                      </div>
                    </div>
                  )}

                  {draftReport && (
                    <div className="border border-amber-100 bg-amber-50/10 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <Badge variant="secondary" className="bg-amber-500 text-white">Taslak Rapor (Kaydedilmiş)</Badge>
                      </div>
                      <div className="text-sm bg-white border rounded-md p-3 whitespace-pre-wrap font-sans text-foreground">
                        {(() => {
                          try {
                            const parsed = JSON.parse(draftReport);
                            return parsed.conclusion || parsed.report || draftReport;
                          } catch {
                            return draftReport;
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Status Change History (takes 1 col) */}
          <div className="flex flex-col gap-6">
            <Card className=" ">
              <CardHeader className="bg-muted/40">
                <CardTitle className="text-base text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Ödeme & Fatura
                </CardTitle>
                <CardDescription className="text-xs">
                  PAYTR sipariş, callback ve Paraşüt fatura durumu
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 grid gap-3">
                {payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-2">Ödeme kaydı yok.</p>
                ) : (
                  payments.map((p) => (
                    <div key={p.id} className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                          {p.status === "paid" ? "Ödendi" : p.status}
                        </Badge>
                        <span className="font-bold">
                          {p.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {p.currency}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {(p.provider || "paytr").toUpperCase()}
                        {p.merchantOid ? ` · ${p.merchantOid}` : ""}
                      </p>
                      {p.orderStatus ? <p>Sipariş: <span className="font-medium">{p.orderStatus}</span></p> : null}
                      {p.callbackStatus ? <p>Callback: <span className="font-medium">{p.callbackStatus}</span></p> : null}
                      <p>
                        Fatura:{" "}
                        <span className={p.invoiceStatus === "failed" ? "text-amber-700 font-semibold" : "font-medium"}>
                          {p.invoiceStatus || "—"}
                          {p.invoiceNumber ? ` · ${p.invoiceNumber}` : ""}
                        </span>
                      </p>
                      {p.invoiceError ? <p className="text-amber-700">{p.invoiceError}</p> : null}
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {p.createdAt ? new Date(p.createdAt).toLocaleString("tr-TR") : ""}
                        {p.paidAt ? ` · ödeme ${new Date(p.paidAt).toLocaleString("tr-TR")}` : ""}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 mt-1"
                        disabled={invoiceLoadingId === p.id}
                        onClick={async () => {
                          const token = getToken();
                          if (!token) return;
                          setInvoiceLoadingId(p.id);
                          try {
                            const inv = await api<Record<string, unknown>>(API.admin.paymentInvoice(p.id), {}, token);
                            setSelectedInvoice(inv);
                          } catch (err) {
                            setError(err instanceof ApiError ? err.message : "E-makbuz yüklenemedi.");
                          } finally {
                            setInvoiceLoadingId("");
                          }
                        }}
                      >
                        E-Makbuz
                      </Button>
                    </div>
                  ))
                )}
                <Link href={ROUTES.admin.payments} className="text-[11px] text-primary underline-offset-2 hover:underline">
                  Tüm ödemeler listesine git
                </Link>
              </CardContent>
            </Card>

            {/* Attachments Card */}
            <Card className=" ">
              <CardHeader className="bg-muted/40">
                <CardTitle className="text-base text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Ekli Dosyalar (PDF & Görsel)
                </CardTitle>
                <CardDescription className="text-xs">
                  Hasta tarafından yüklenen tıbbi evraklar
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 grid gap-2">
                {attachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-2">Yüklenmiş dosya yok.</p>
                ) : (
                  <div className="grid gap-2">
                    {attachments.map((file) => (
                      <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border p-2 text-xs bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate text-foreground">{file.fileName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {(file.fileSize / 1024).toFixed(1)} KB · {file.mimeType}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAttachment(file.id, file.fileName, file.mimeType)}
                          className="h-7 px-3 text-[10px] bg-white"
                        >
                          Aç
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className=" ">
              <CardHeader>
                <CardTitle className="text-base">Başvuru Geçmişi</CardTitle>
                <CardDescription>
                  Oluşturma, ödeme, doktor incelemesi, rapor ve durum adımlarının tarih/saat kaydı.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {timeline.length === 0 ? (
                  <p className="p-4 text-center text-sm italic text-muted-foreground">Geçmiş kaydı yok.</p>
                ) : (
                  <div className="divide-y">
                    {timeline.map((h, i) => (
                      <div key={`${h.type}-${h.createdAt}-${i}`} className="flex gap-3 px-4 py-3">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={h.type === "status" && h.newStatusCode != null ? statusVariant(h.newStatusCode) : timelineBadge(h.type)} className="text-[10px]">
                              {h.title || (h.newStatusCode != null ? STATUS_LABELS[h.newStatusCode] : h.type)}
                            </Badge>
                            {h.type === "status" && h.newStatusCode != null ? (
                              <span className="text-[10px] text-muted-foreground">
                                {STATUS_LABELS[h.newStatusCode] ?? h.newStatusCode}
                              </span>
                            ) : null}
                          </div>
                          {h.detail ? <p className="text-xs text-muted-foreground">{h.detail}</p> : null}
                          {h.note ? <p className="text-[10px] italic text-muted-foreground">{h.note}</p> : null}
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {formatWhen(h.createdAt)}
                            {h.actor ? ` · ${h.actor}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {selectedInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">E-Makbuz özeti</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>
                Kapat
              </Button>
            </div>
            <dl className="space-y-2 text-xs">
              <div><dt className="text-muted-foreground">Hasta</dt><dd className="font-semibold">{String(selectedInvoice.patientName ?? "—")}</dd></div>
              <div><dt className="text-muted-foreground">Tutar</dt><dd className="font-semibold">{String(selectedInvoice.amount)} {String(selectedInvoice.currency ?? "TRY")}</dd></div>
              <div><dt className="text-muted-foreground">Merchant OID</dt><dd className="font-mono">{String(selectedInvoice.merchantOid || "—")}</dd></div>
              <div><dt className="text-muted-foreground">Sipariş / Callback</dt><dd>{String(selectedInvoice.orderStatus || "—")} / {String(selectedInvoice.callbackStatus || "—")}</dd></div>
              <div><dt className="text-muted-foreground">Fatura</dt><dd>{String(selectedInvoice.invoiceNumber || selectedInvoice.invoiceStatus || "—")}</dd></div>
              {selectedInvoice.invoiceError ? (
                <div className="text-amber-700"><dt>Fatura hatası</dt><dd>{String(selectedInvoice.invoiceError)}</dd></div>
              ) : null}
              {typeof selectedInvoice.invoicePdfUrl === "string" && selectedInvoice.invoicePdfUrl ? (
                <div>
                  <a className="text-primary underline" href={selectedInvoice.invoicePdfUrl} target="_blank" rel="noreferrer">
                    PDF aç
                  </a>
                </div>
              ) : null}
            </dl>
            <p className="mt-4">
              <Link href={ROUTES.admin.payments} className="text-xs text-primary underline">
                Ödemeler listesinde detay
              </Link>
            </p>
          </div>
        </div>
      ) : null}
    </AdminAppShell>
  );
}
