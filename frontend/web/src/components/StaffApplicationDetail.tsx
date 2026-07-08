"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getUser } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { API } from "@/lib/endpoints";
import {
  staffStatusLabel,
  statusVariant,
  applicationDisplayNumber,
  isDoctorReportWritable,
  isNurseReviewStatus,
  isConcludedStatus,
  type ApplicationDetail,
  type ApplicationNote,
} from "@/lib/application";
import { DoctorReportEditor } from "@/components/DoctorReportEditor";
import { ApplicationPreviewPanel } from "@/components/ApplicationPreviewPanel";
import { ApplicationPreviewModal } from "@/components/ApplicationPreviewModal";
import { DoctorFlowSteps, type DoctorFlowStep } from "@/components/DoctorFlowSteps";
import { FormAlert, FormField } from "@/components/FormField";
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
import { ArrowLeft, Check, FileEdit } from "lucide-react";

type Props = {
  id: string;
  token: string;
  backHref?: string;
};

export function StaffApplicationDetail({ id, token, backHref = ROUTES.doctor.dashboard }: Props) {
  const router = useRouter();
  const user = getUser();
  const role = user?.role;
  const isNurse = role === "nurse" || role === "admin" || role === "developer";
  const isDoctor = role === "doctor" || role === "admin" || role === "developer";

  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flowStep, setFlowStep] = useState<DoctorFlowStep>("application");
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [flowInitialized, setFlowInitialized] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      api<ApplicationDetail>(API.applications.detail(id), {}, token),
      api<ApplicationNote[]>(API.applications.notes(id), {}, token).catch(() => []),
    ]).then(([detail, noteList]) => {
      setApp(detail);
      setNotes(noteList ?? []);
      return detail;
    });
  }, [id, token]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof ApiError ? err.message : "Başvuru yüklenemedi."))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!app || flowInitialized || !isDoctor) return;
    const concluded = isConcludedStatus(app.statusCode);
    setFlowStep(concluded ? "edit" : "application");
    setFlowInitialized(true);
  }, [app, flowInitialized, isDoctor]);

  function goToFlow(step: DoctorFlowStep) {
    setFlowStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function assess(approved: boolean) {
    setBusy(true);
    setError("");
    try {
      await api(API.applications.assess(id), {
        method: "POST",
        body: JSON.stringify({ isApproved: approved, reason: rejectReason }),
      }, token);
      setMsg(approved ? "Başvuru onaylandı." : "Başvuru reddedildi.");
      setRejectReason("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Değerlendirme başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function sendToDoctor() {
    setBusy(true);
    try {
      await api(API.applications.sendToDoctor(id), { method: "POST", body: "{}" }, token);
      setMsg("Başvuru doktora yönlendirildi.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yönlendirme başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      await api(API.applications.notes(id), {
        method: "POST",
        body: JSON.stringify({ content: noteText.trim() }),
      }, token);
      setNoteText("");
      setMsg("Not eklendi.");
      api<ApplicationNote[]>(API.applications.notes(id), {}, token).then(setNotes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto py-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="max-w-5xl mx-auto py-6">
        <FormAlert title="Bulunamadı" message="Başvuru detayları alınamadı." />
      </div>
    );
  }

  const showReportEditor = isDoctor && isDoctorReportWritable(app.statusCode);
  const isConcluded = isConcludedStatus(app.statusCode);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:gap-6 py-0 sm:py-2 font-sans">
      <div className="flex flex-wrap items-start gap-2 sm:gap-3">
        <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 shrink-0" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4 text-slate-500" />
            Geri
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex flex-wrap items-center gap-2 break-words">
            Başvuru: {applicationDisplayNumber(app)}
            <Badge variant={statusVariant(app.statusCode)} className="text-[10px] font-semibold py-0.5 px-2 shrink-0">
              {staffStatusLabel(app.statusCode)}
            </Badge>
          </h2>
        </div>
      </div>

      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      ) : null}

      {showReportEditor ? <DoctorFlowSteps step={flowStep} /> : null}

      {/* ADIM 1: Hasta başvuru formu */}
      {showReportEditor && flowStep === "application" ? (
        <Card className="shadow-premium border-slate-200 bg-white border-2">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-4 sm:py-4 sm:px-6">
            <CardTitle className="text-sm font-bold text-slate-800">Hasta Başvuru Formu (PDF)</CardTitle>
            <CardDescription className="text-xs">
              Hastanın gönderdiği başvuru belgesini inceleyin. Rapor yazmaya geçmeden önce tüm bilgileri kontrol edin.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ApplicationPreviewPanel applicationId={id} token={token} />
          </CardContent>
          <CardFooter className="border-t pt-4 px-4 sm:px-6 flex flex-col gap-2 sm:flex-row sm:justify-end bg-slate-50/50">
            <Button onClick={() => goToFlow("edit")} className="gap-2 h-10 px-6 rounded-xl font-bold w-full sm:w-auto">
              <FileEdit className="h-4 w-4" />
              Rapor Yaz
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {isNurse && isNurseReviewStatus(app.statusCode) ? (
        <Card className="border-primary/20 shadow-premium bg-white">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-sm font-bold text-slate-800">Sekreterya İnceleme & Ön Onay Paneli</CardTitle>
            <CardDescription className="text-xs">
              Evrak ve kayıt kontrollerini yaparak başvuruyu hekime yönlendirin veya reddedin.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col gap-4">
            <FormField id="rejectReason" label="Red Nedeni (Yalnızca Red Durumunda Gerekli)">
              <Textarea
                id="rejectReason"
                placeholder="Başvurunun reddedilme nedenini buraya yazın..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[80px]"
              />
            </FormField>
          </CardContent>
          <CardFooter className="border-t pt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end bg-slate-50/40 px-4 sm:px-6">
            <Button variant="destructive" disabled={busy} onClick={() => assess(false)} className="rounded-xl font-bold w-full sm:w-auto">
              Reddet
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => assess(true)} className="rounded-xl font-bold w-full sm:w-auto">
              Onayla
            </Button>
            <Button variant="default" disabled={busy} onClick={sendToDoctor} className="rounded-xl font-bold w-full sm:w-auto">
              Hekime Yönlendir
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {/* ADIM 2 & 3: Rapor yazımı ve önizleme */}
      {showReportEditor && (flowStep === "edit" || flowStep === "preview") ? (
        <DoctorReportEditor
          applicationId={id}
          token={token}
          isConcluded={isConcluded}
          onConcluded={() => router.push(backHref)}
          onStepChange={(s) => goToFlow(s)}
          onViewApplication={() => setAppModalOpen(true)}
        />
      ) : null}

      {flowStep === "application" || !showReportEditor ? (
        <Card className="shadow-premium border-slate-200 bg-white">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-4 sm:py-4 sm:px-6">
            <CardTitle className="text-sm font-bold text-slate-800">Dahili Ekip Notları</CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid gap-4">
            {notes.length === 0 ? (
              <p className="text-slate-400 italic text-xs">Bu başvuruya henüz dahili not eklenmemiş.</p>
            ) : (
              <ul className="grid gap-3">
                {notes.map((n, i) => (
                  <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-xs shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-700">{n.author}</span>
                      <span className="text-slate-400 font-medium">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString("tr-TR") : ""}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={addNote} className="flex flex-col gap-3 pt-3 border-t border-slate-100">
              <FormField id="staff-note" label="Yeni Not Ekle" hint="Yalnızca hastane personeli tarafından görünür.">
                <Textarea
                  id="staff-note"
                  rows={2}
                  placeholder="Dahili çalışma notlarınızı buraya yazın..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="text-xs rounded-xl shadow-inner-sm border-slate-200"
                />
              </FormField>
              <Button type="submit" size="sm" className="self-start h-9 px-5 rounded-xl font-bold" disabled={busy}>
                Not Ekle
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <ApplicationPreviewModal
        applicationId={id}
        token={token}
        isOpen={appModalOpen}
        onClose={() => setAppModalOpen(false)}
      />
    </div>
  );
}
