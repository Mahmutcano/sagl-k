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
import { ArrowLeft, FileEdit } from "lucide-react";

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
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flowStep, setFlowStep] = useState<DoctorFlowStep>("application");
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [flowInitialized, setFlowInitialized] = useState(false);

  const load = useCallback(() => {
    return api<ApplicationDetail>(API.applications.detail(id), {}, token).then((detail) => {
      setApp(detail);
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
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Geri
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="flex flex-wrap items-center gap-2 break-words text-base font-semibold sm:text-lg">
            Başvuru: {applicationDisplayNumber(app)}
            <Badge variant={statusVariant(app.statusCode)} className="shrink-0">
              {staffStatusLabel(app.statusCode)}
            </Badge>
          </h2>
        </div>
      </div>

      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Bilgi" message={msg} variant="default" /> : null}

      {showReportEditor ? <DoctorFlowSteps step={flowStep} /> : null}

      {/* ADIM 1: Hasta başvuru formu */}
      {showReportEditor && flowStep === "application" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hasta Başvuru Formu (PDF)</CardTitle>
            <CardDescription>
              Hastanın gönderdiği başvuru belgesini inceleyin. Rapor yazmaya geçmeden önce tüm bilgileri kontrol edin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApplicationPreviewPanel applicationId={id} token={token} />
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t sm:flex-row sm:justify-end">
            <Button onClick={() => goToFlow("edit")} className="w-full gap-2 sm:w-auto">
              <FileEdit className="h-4 w-4" />
              Rapor Yaz
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {isNurse && isNurseReviewStatus(app.statusCode) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sekreterya İnceleme & Ön Onay Paneli</CardTitle>
            <CardDescription>
              Evrak ve kayıt kontrollerini yaparak başvuruyu hekime yönlendirin veya reddedin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
          <CardFooter className="flex flex-col gap-2 border-t sm:flex-row sm:flex-wrap sm:justify-end">
            <Button variant="destructive" disabled={busy} onClick={() => assess(false)} className="w-full sm:w-auto">
              Reddet
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => assess(true)} className="w-full sm:w-auto">
              Onayla
            </Button>
            <Button variant="default" disabled={busy} onClick={sendToDoctor} className="w-full sm:w-auto">
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

      <ApplicationPreviewModal
        applicationId={id}
        token={token}
        isOpen={appModalOpen}
        onClose={() => setAppModalOpen(false)}
      />
    </div>
  );
}
