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
	isPatientCancellableStatus,
	isSurveyComplete,
	type ApplicationAttachment,
	type ApplicationDetail,
	type ApplicationNote,
	type FinalReport,
} from "@/lib/application";
import {
	SURVEY_FIELDS,
	downloadApplicationAttachment,
	parseSurveyData,
} from "@/lib/applicationSurvey";
import { FormAlert, FormField } from "@/components/FormField";
import { ApplicationPreviewPanel } from "@/components/ApplicationPreviewPanel";
import { ApplicationFlowSteps } from "@/components/ApplicationFlowSteps";
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
import { Textarea } from "@/components/ui/textarea";
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
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [attachments, setAttachments] = useState<ApplicationAttachment[]>([]);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      api<ApplicationDetail>(API.applications.detail(id), {}, token),
      api<ApplicationNote[]>(API.applications.notes(id), {}, token).catch(() => []),
      api<ApplicationAttachment[]>(API.applications.attachments(id), {}, token).catch(() => []),
    ]).then(async ([detail, noteList, attachmentList]) => {
      setApp(detail);
      setNotes(noteList ?? []);
      setAttachments(attachmentList ?? []);
      if (isConcludedStatus(detail.statusCode)) {
        try {
          const rep = await api<FinalReport>(API.applications.report(id), {}, token);
          setReport(rep);
        } catch {
          setReport(null);
        }
      } else {
        setReport(null);
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

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setNoteSaving(true);
    setError("");
    try {
      await api(API.applications.notes(id), {
        method: "POST",
        body: JSON.stringify({ content: noteText.trim() }),
      }, token);
      setNoteText("");
      const noteList = await api<ApplicationNote[]>(API.applications.notes(id), {}, token);
      setNotes(noteList ?? []);
      setMsg("Notunuz eklendi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not eklenemedi.");
    } finally {
      setNoteSaving(false);
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
          {STATUS_LABELS[app.statusCode] ?? `Durum ${app.statusCode}`}
        </Badge>
        {isPatientEditableStatus(app.statusCode) ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.patient.editApplication(id)}>Başvuruyu düzenle</Link>
          </Button>
        ) : null}
        {isPatientCancellableStatus(app.statusCode) ? (
          <Button variant="destructive" size="sm" type="button" onClick={cancelApplication}>
            Başvuruyu iptal et
          </Button>
        ) : null}
      </div>

      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Bilgi" message={msg} variant="default" /> : null}

      <Card>
        <CardHeader>
          <CardTitle>{app.professionName ?? "Başvuru"}</CardTitle>
          <CardDescription>
            Başvuru no: {applicationDisplayNumber(app)}
            {app.isForRelative ? " · Yakın adına" : " · Kendi adıma"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Branş kodu</p>
            <p className="font-medium">{app.professionCode ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Başvuru no</p>
            <p className="font-medium font-mono text-xs break-all">{app.applicationId}</p>
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

      {isConcludedStatus(app.statusCode) && report ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tıbbi rapor</CardTitle>
            <CardDescription>
              {report.createdAt
                ? `Sonuçlandırma: ${new Date(report.createdAt).toLocaleString("tr-TR")}`
                : "Başvurunuz sonuçlandırıldı."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto rounded-lg border bg-muted/30 p-3 max-h-96">
              {typeof report.reportJson === "string"
                ? report.reportJson
                : JSON.stringify(report.reportJson ?? {}, null, 2)}
            </pre>
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

      {app.statusCode >= 1 && hasSurveyContent ? (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notlar</CardTitle>
          <CardDescription>Ekibinizle yazışma geçmişi</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {notes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz not yok.</p>
          ) : (
            <ul className="grid gap-2">
              {notes.map((n, i) => (
                <li key={i} className="rounded-lg border px-3 py-2 text-sm">
                  <p className="font-medium">{n.author}</p>
                  <p className="text-muted-foreground text-xs">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString("tr-TR") : ""}
                  </p>
                  <p className="mt-1">{n.content}</p>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addNote} className="flex flex-col gap-3">
            <FormField id="note" label="Not ekle">
              <Textarea
                id="note"
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Sorunuz veya ek bilginiz..."
              />
            </FormField>
            <Button type="submit" size="sm" className="self-start" disabled={noteSaving}>
              {noteSaving ? "Kaydediliyor..." : "Not gönder"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => router.refresh()}>
        Yenile
      </Button>

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
