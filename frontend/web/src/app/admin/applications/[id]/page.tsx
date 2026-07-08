"use client";

import { ROUTES } from "@/lib/routes";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken, getUser, isAdminRole, clearAuth, fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { STATUS_LABELS, statusVariant, type StatusHistoryItem, type ApplicationDetail } from "@/lib/application";
import { parseSurveyData, type ApplicationSurveyAnswers } from "@/lib/applicationSurvey";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, FormField, FormSelect, BirthDateSelect, TextInput } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApplicationCatalog } from "@/hooks/useApplicationCatalog";
import { FileText } from "lucide-react";

export default function AdminApplicationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  
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

  const catalog = useApplicationCatalog(1, professionCode, true);

  const loadData = useCallback(async (token: string) => {
    try {
      const histData = await api<StatusHistoryItem[]>(API.admin.applicationHistory(params.id), {}, token);
      setHistory(histData);

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
            <Card className="large-form shadow-md border-slate-200">
              <form onSubmit={handleAdminSave} noValidate>
                <CardHeader>
                  <CardTitle>Başvuru Bilgilerini Düzenle</CardTitle>
                  <CardDescription>
                    Yönetici olarak bu başvurunun tüm şikayet, bölüm, hekim ve hasta (veya yakın) bilgilerini direkt güncelleyebilirsiniz.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Operasyonel Durum & Hekim Atama</h4>
                    <div className="grid gap-6 sm:grid-cols-3 bg-slate-50/60 border border-slate-200/50 rounded-2xl p-5 shadow-sm">
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
              <Card className="shadow-md border-slate-200">
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
                      <div className="text-sm bg-white border rounded-md p-3 whitespace-pre-wrap font-sans text-slate-800">
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
                      <div className="text-sm bg-white border rounded-md p-3 whitespace-pre-wrap font-sans text-slate-800">
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
            {/* Attachments Card */}
            <Card className="shadow-md border-slate-200">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-500" />
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
                      <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border p-2 text-xs bg-slate-50/50">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate text-slate-800">{file.fileName}</p>
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

            <Card className="shadow-md border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Durum Geçmişi</CardTitle>
                <CardDescription>Başvurunun geçirdiği tüm durum değişikliklerinin geçmişi.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {history.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground italic text-center">Durum geçmişi yok.</p>
                ) : (
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hedef Durum</TableHead>
                        <TableHead>Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h, i) => (
                        <TableRow key={i} className="hover:bg-muted/10">
                          <TableCell>
                            <Badge variant={statusVariant(h.newStatusCode)} className="text-[10px] px-1.5 py-0.5">
                              {STATUS_LABELS[h.newStatusCode] ?? h.newStatusCode}
                            </Badge>
                            {h.note ? (
                              <p className="text-[10px] text-muted-foreground mt-0.5 italic">{h.note}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-[10px]">
                            {h.createdAt ? new Date(h.createdAt).toLocaleString("tr-TR") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AdminAppShell>
  );
}
