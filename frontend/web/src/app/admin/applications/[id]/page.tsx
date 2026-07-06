"use client";

import { ROUTES } from "@/lib/routes";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken, getUser, isAdminRole, clearAuth } from "@/lib/api";
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

export default function AdminApplicationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  
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

  const catalog = useApplicationCatalog(1, professionCode, true);

  const loadData = useCallback(async (token: string) => {
    try {
      const histData = await api<StatusHistoryItem[]>(API.admin.applicationHistory(params.id), {}, token);
      setHistory(histData);

      const appData = await api<ApplicationDetail>(API.applications.detail(params.id), {}, token);
      setApp(appData);
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
                  <h4 className="text-sm font-semibold border-b pb-1 text-primary">Operasyonel Durum</h4>
                  <div className="grid gap-4 sm:grid-cols-3">
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
          </div>

          {/* Right Column: Status Change History (takes 1 col) */}
          <div className="flex flex-col gap-6">
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
