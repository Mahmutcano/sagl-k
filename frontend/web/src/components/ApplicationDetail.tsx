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
  type ApplicationDetail,
  type ApplicationNote,
  type FinalReport,
  type PaymentRequest,
  type PaymentResult,
} from "@/lib/application";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  id: string;
  token: string;
  backHref?: string;
};

const PAYMENT_AMOUNT = 1500;

export function PatientApplicationDetail({ id, token, backHref = ROUTES.patient.applications }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [provider, setProvider] = useState<"param" | "bizimhesap">("param");
  const [card, setCard] = useState({
    cardHolder: "",
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    return Promise.all([
      api<ApplicationDetail>(API.applications.detail(id), {}, token),
      api<ApplicationNote[]>(API.applications.notes(id), {}, token).catch(() => []),
    ]).then(async ([detail, noteList]) => {
      setApp(detail);
      setNotes(noteList ?? []);
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

  function validatePaymentForm(): boolean {
    const f: Record<string, string> = {};
    if (!card.cardHolder.trim() || card.cardHolder.trim().length < 3) {
      f.cardHolder = "Kart üzerindeki isim en az 3 karakter olmalıdır.";
    }
    const digits = card.cardNumber.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) {
      f.cardNumber = "Geçerli bir kart numarası giriniz.";
    }
    const month = parseInt(card.expiryMonth, 10);
    if (!month || month < 1 || month > 12) {
      f.expiryMonth = "Ay 1–12 arasında olmalıdır.";
    }
    const year = parseInt(card.expiryYear, 10);
    if (!year || year < new Date().getFullYear() % 100) {
      f.expiryYear = "Geçerli bir yıl giriniz.";
    }
    const cvvDigits = card.cvv.replace(/\D/g, "");
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      f.cvv = "CVV 3 veya 4 haneli olmalıdır.";
    }
    setFieldErrors(f);
    return Object.keys(f).length === 0;
  }

  async function pay() {
    setPaying(true);
    setMsg("");
    setError("");
    setFieldErrors({});

    const body: PaymentRequest = { provider };
    const hasCardInput =
      card.cardHolder || card.cardNumber || card.expiryMonth || card.expiryYear || card.cvv;
    if (hasCardInput) {
      if (!validatePaymentForm()) {
        setPaying(false);
        return;
      }
      body.cardHolder = card.cardHolder.trim();
      body.cardNumber = card.cardNumber.replace(/\s/g, "");
      body.expiryMonth = parseInt(card.expiryMonth, 10);
      body.expiryYear = parseInt(card.expiryYear, 10);
      body.cvv = card.cvv.replace(/\D/g, "");
    }

    try {
      const res = await api<PaymentResult>(
        API.applications.payment(id),
        { method: "POST", body: JSON.stringify(body) },
        token
      );
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      if (res.status === "paid" || res.status === "success" || res.status === "completed") {
        setMsg("Ödeme başarıyla tamamlandı.");
        await load();
      } else {
        setMsg(`Ödeme durumu: ${res.status}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields);
      }
      setError(err instanceof ApiError ? err.message : "Ödeme başarısız.");
    } finally {
      setPaying(false);
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

  const survey =
    typeof app.surveyData === "string"
      ? app.surveyData
      : JSON.stringify(app.surveyData ?? {}, null, 2);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>← Listeye dön</Link>
        </Button>
        <Badge variant={statusVariant(app.statusCode)}>
          {STATUS_LABELS[app.statusCode] ?? `Durum ${app.statusCode}`}
        </Badge>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ödeme</CardTitle>
            <CardDescription>
              Başvurunuzun işleme alınması için ödeme gereklidir ({PAYMENT_AMOUNT.toLocaleString("tr-TR")} TRY).
              Test modunda kart bilgisi isteğe bağlıdır; canlı modda zorunludur.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={provider === "param" ? "default" : "outline"}
                size="sm"
                onClick={() => setProvider("param")}
              >
                Param
              </Button>
              <Button
                type="button"
                variant={provider === "bizimhesap" ? "default" : "outline"}
                size="sm"
                onClick={() => setProvider("bizimhesap")}
              >
                Bizim Hesap
              </Button>
            </div>
            <FormField id="cardHolder" label="Kart üzerindeki isim" error={fieldErrors.cardHolder}>
              <Input
                id="cardHolder"
                autoComplete="cc-name"
                value={card.cardHolder}
                onChange={(e) => setCard((c) => ({ ...c, cardHolder: e.target.value }))}
              />
            </FormField>
            <FormField id="cardNumber" label="Kart numarası" error={fieldErrors.cardNumber}>
              <Input
                id="cardNumber"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                value={card.cardNumber}
                onChange={(e) => setCard((c) => ({ ...c, cardNumber: e.target.value }))}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="expiryMonth" label="Ay (MM)" error={fieldErrors.expiryMonth}>
                <Input
                  id="expiryMonth"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                  placeholder="MM"
                  maxLength={2}
                  value={card.expiryMonth}
                  onChange={(e) => setCard((c) => ({ ...c, expiryMonth: e.target.value }))}
                />
              </FormField>
              <FormField id="expiryYear" label="Yıl (YY)" error={fieldErrors.expiryYear}>
                <Input
                  id="expiryYear"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                  placeholder="YY"
                  maxLength={2}
                  value={card.expiryYear}
                  onChange={(e) => setCard((c) => ({ ...c, expiryYear: e.target.value }))}
                />
              </FormField>
              <FormField id="cvv" label="CVV" error={fieldErrors.cvv}>
                <Input
                  id="cvv"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="***"
                  maxLength={4}
                  value={card.cvv}
                  onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value }))}
                />
              </FormField>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
            <Button disabled={paying} onClick={pay}>
              {paying ? "İşleniyor..." : "Ödemeyi tamamla"}
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Başvuru özeti</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto rounded-lg border bg-muted/30 p-3 max-h-64">
            {survey}
          </pre>
        </CardContent>
      </Card>

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
    </div>
  );
}
