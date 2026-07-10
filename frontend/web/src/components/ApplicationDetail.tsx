"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { API } from "@/lib/endpoints";
import {
	STATUS_LABELS,
	statusVariant,
	applicationDisplayNumber,
	isConcludedStatus,
	isPatientEditableStatus,
	isPatientAwaitingDoctor,
	isPatientCancellableStatus,
	isSurveyComplete,
	type ApplicationAttachment,
	type ApplicationDetail,
	type FinalReport,
} from "@/lib/application";
import {
	SURVEY_FIELDS,
	downloadApplicationAttachment,
	parseSurveyData,
} from "@/lib/applicationSurvey";
import { FormAlert } from "@/components/FormField";
import { ApplicationPreviewPanel } from "@/components/ApplicationPreviewPanel";
import { PatientReportPanel } from "@/components/PatientReportPanel";
import { ApplicationFlowSteps } from "@/components/ApplicationFlowSteps";
import { ApplicationChat } from "@/modules/chat/ApplicationChat";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ArrowLeft } from "lucide-react";

type Props = {
  id: string;
  token: string;
  backHref?: string;
};

export function PatientApplicationDetail({ id, token, backHref = ROUTES.patient.applications }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [attachments, setAttachments] = useState<ApplicationAttachment[]>([]);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      api<ApplicationDetail>(API.applications.detail(id), {}, token),
      api<ApplicationAttachment[]>(API.applications.attachments(id), {}, token).catch(() => []),
    ]).then(async ([detail, attachmentList]) => {
      setApp(detail);
      setAttachments(attachmentList ?? []);
      if (isConcludedStatus(detail.statusCode)) {
        setReportLoading(true);
        try {
          const rep = await api<FinalReport>(API.applications.report(id), {}, token);
          setReport(rep);
        } catch {
          setReport(null);
        } finally {
          setReportLoading(false);
        }
      } else {
        setReport(null);
        setReportLoading(false);
      }
    });
  }, [id, token]);

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") setMsg("Ödeme başarıyla tamamlandı.");
    if (payment === "failed") setError("Ödeme tamamlanamadı. Lütfen tekrar deneyin.");
  }, [searchParams]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof ApiError ? err.message : "Başvuru yüklenemedi."))
      .finally(() => setLoading(false));
  }, [load]);

  function cancelApplication() {
    setIsConfirmOpen(true);
  }

  async function handleConfirmCancel() {
    setIsConfirmOpen(false);
    setError("");
    try {
      await api(API.applications.cancel(id), { method: "DELETE" }, token);
      router.push(backHref);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Başvuru iptal edilemedi.");
    }
  }

  if (loading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!app) {
    return <FormAlert title="Hata" message={error || "Başvuru bulunamadı."} />;
  }

  const surveyAnswers = parseSurveyData(app.surveyData);
  const hasSurveyContent = SURVEY_FIELDS.some((f) => surveyAnswers[f.key]?.trim());
  const surveyComplete = isSurveyComplete(app.surveyData);
  const flowCurrent =
    app.statusCode === 0
      ? surveyComplete
        ? ("preview" as const)
        : app.professionCode
          ? ("survey" as const)
          : ("details" as const)
      : ("preview" as const);

  if (isConcludedStatus(app.statusCode)) {
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Listeye dön
            </Link>
          </Button>
          <Badge variant={statusVariant(app.statusCode)}>
            {STATUS_LABELS[app.statusCode]}
          </Badge>
        </div>

        {error ? <FormAlert title="Hata" message={error} /> : null}

        <PatientReportPanel
          applicationId={id}
          token={token}
          report={report}
          reportLoading={reportLoading}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="w-fit gap-1.5 px-0 sm:px-3">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            Listeye dön
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isPatientEditableStatus(app.statusCode) ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={ROUTES.patient.editApplication(id, "details")}>
                  Bölüm / doktor
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={ROUTES.patient.editApplication(id)}>Başvuruya devam et</Link>
              </Button>
            </>
          ) : null}
          {isPatientCancellableStatus(app.statusCode) ? (
            <Button variant="destructive" size="sm" type="button" onClick={cancelApplication}>
              İptal et
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Bilgi" message={msg} variant="default" /> : null}

      {isPatientAwaitingDoctor(app.statusCode) ? (
        <Alert>
          <AlertTitle>Doktorunuz tarafından raporlanıyor</AlertTitle>
          <AlertDescription>
            Ödemeniz alındı. Uzman hekiminiz başvurunuzu inceliyor ve rapor hazırlıyor.
            Bu aşamada başvuruda düzenleme yapılamaz; süreç tamamlandığında bilgilendirileceksiniz.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1">
            <CardTitle>{app.professionName ?? "Başvuru"}</CardTitle>
            <CardDescription>
              Başvuru no: {applicationDisplayNumber(app)}
              {app.isForRelative ? " · Yakın adına" : " · Kendi adıma"}
            </CardDescription>
          </div>
          <Badge variant={statusVariant(app.statusCode)} className="shrink-0">
            {STATUS_LABELS[app.statusCode] ?? `Durum ${app.statusCode}`}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Uzman hekim</p>
            <p className="font-medium">
              {app.doctorName?.trim() ? app.doctorName : "Atanmadı"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Başvuru tarihi</p>
            <p className="font-medium">
              {app.createdAt
                ? new Date(app.createdAt).toLocaleDateString("tr-TR")
                : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {app.isForRelative && app.representedPerson ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yakın bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="text-sm grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Ad soyad: </span>
              {app.representedPerson.firstName} {app.representedPerson.lastName}
            </p>
            <p>
              <span className="text-muted-foreground">TC: </span>
              {app.representedPerson.nationalIdentifier ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Doğum: </span>
              {app.representedPerson.birthDate ?? "—"}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {app.statusCode === 0 ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Başvuru adımları</CardTitle>
            <CardDescription>
              Önizleme (Adım 3) ve ödeme (Adım 4) ayrı ekranlardır. Ödeme yalnızca formu
              onayladıktan sonra yapılır.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ApplicationFlowSteps current={flowCurrent} compact />
            {surveyComplete ? (
              <>
                <Alert>
                  <AlertTitle>Adım 3 — Form önizleme</AlertTitle>
                  <AlertDescription>
                    Aşağıda başvuru formunuzun özeti var. Ödeme için &quot;Adım 4 — Ödemeye geç&quot;
                    butonunu kullanın.
                  </AlertDescription>
                </Alert>
                <ApplicationPreviewPanel applicationId={id} token={token} />
              </>
            ) : (
              <Alert>
                <AlertTitle>Devam edin</AlertTitle>
                <AlertDescription>
                  Önce bölüm ve şikayet adımlarını tamamlayın; ardından form önizleme ve ödeme
                  sırasıyla gelir.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2 border-t">
            <Button asChild>
              <Link href={ROUTES.patient.editApplication(id)}>Adımlara devam et</Link>
            </Button>
            {surveyComplete ? (
              <Button asChild variant="secondary">
                <Link href={ROUTES.patient.editApplication(id, "payment")}>
                  Adım 4 — Ödemeye geç
                </Link>
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      ) : null}

      {app.statusCode >= 1 && !isConcludedStatus(app.statusCode) && hasSurveyContent ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Form önizleme</CardTitle>
            <CardDescription>PDF olarak kaydetmek için yazdır butonunu kullanın.</CardDescription>
          </CardHeader>
          <CardContent>
            <ApplicationPreviewPanel applicationId={id} token={token} />
          </CardContent>
        </Card>
      ) : null}

      {!hasSurveyContent || (app.statusCode === 0 && !surveyComplete) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Başvuru bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {hasSurveyContent ? (
              SURVEY_FIELDS.map((field) =>
                surveyAnswers[field.key]?.trim() ? (
                  <div key={field.key}>
                    <p className="text-muted-foreground">{field.label}</p>
                    <p className="whitespace-pre-wrap">{surveyAnswers[field.key]}</p>
                  </div>
                ) : null
              )
            ) : (
              <p className="text-muted-foreground">Anket yanıtı bulunmuyor.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {attachments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yüklenen belgeler</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {attachments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="truncate">{a.fileName}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadApplicationAttachment(id, a.id, a.fileName, token).catch(() =>
                        setError("Dosya indirilemedi.")
                      )
                    }
                  >
                    İndir
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ApplicationChat
        applicationId={id}
        token={token}
        enabled={app.statusCode >= 1 && !isConcludedStatus(app.statusCode)}
      />

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Başvuruyu İptal Et"
        message="Başvuru iptal edilecek ve kalıcı olarak silinecek. Devam etmek istiyor musunuz?"
        confirmText="Evet, İptal Et"
        variant="destructive"
        onConfirm={handleConfirmCancel}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}
