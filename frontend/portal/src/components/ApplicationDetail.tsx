"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  STATUS_LABELS,
  statusVariant,
  type ApplicationDetail,
  type ApplicationNote,
  type PaymentResult,
} from "@/lib/application";
import { FormAlert, FormField } from "@/components/FormField";

type Props = {
  id: string;
  token: string;
  backHref?: string;
};

export function PatientApplicationDetail({ id, token, backHref = "/applications" }: Props) {
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      api<ApplicationDetail>(API.applications.detail(id), {}, token),
      api<ApplicationNote[]>(API.applications.notes(id), {}, token).catch(() => []),
    ]).then(([detail, noteList]) => {
      setApp(detail);
      setNotes(noteList ?? []);
    });
  }, [id, token]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof ApiError ? err.message : "Başvuru yüklenemedi."))
      .finally(() => setLoading(false));
  }, [load]);

  async function pay(provider: "param" | "bizimhesap") {
    setPaying(true);
    setMsg("");
    setError("");
    try {
      const res = await api<PaymentResult>(
        API.applications.payment(id, provider),
        { method: "POST", body: "{}" },
        token
      );
      if (res.status === "paid") {
        setMsg("Ödeme başarıyla tamamlandı.");
        await load();
      } else {
        setMsg(`Ödeme durumu: ${res.status}`);
      }
    } catch (err) {
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
        <div className="skeleton h-8 w-1/2" />
        <div className="skeleton h-32 w-full" />
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
        <Link href={backHref} className="btn" data-variant="ghost" data-size="sm">
          ← Listeye dön
        </Link>
        <span className="badge" data-variant={statusVariant(app.statusCode)}>
          {STATUS_LABELS[app.statusCode] ?? `Durum ${app.statusCode}`}
        </span>
      </div>

      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Bilgi" message={msg} /> : null}

      <div className="card">
        <header>
          <h2>{app.professionName ?? "Başvuru"}</h2>
          <p>
            {app.ecommerceNumber ?? "—"}
            {app.isForRelative ? " · Yakın adına" : " · Kendi adıma"}
          </p>
        </header>
        <section className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Branş kodu</p>
            <p className="font-medium">{app.professionCode ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Başvuru no</p>
            <p className="font-medium font-mono text-xs break-all">{app.applicationId}</p>
          </div>
        </section>
      </div>

      {app.isForRelative && app.representedPerson ? (
        <div className="card">
          <header>
            <h3>Yakın bilgileri</h3>
          </header>
          <section className="text-sm grid gap-2 sm:grid-cols-2">
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
          </section>
        </div>
      ) : null}

      {app.statusCode === 0 ? (
        <div className="card">
          <header>
            <h3>Ödeme</h3>
            <p>Başvurunuzun işleme alınması için ödeme gereklidir (1.500 TRY).</p>
          </header>
          <footer className="flex flex-wrap gap-2 border-t">
            <button type="button" className="btn" disabled={paying} onClick={() => pay("param")}>
              {paying ? "İşleniyor..." : "Param ile öde"}
            </button>
            <button
              type="button"
              className="btn"
              data-variant="outline"
              disabled={paying}
              onClick={() => pay("bizimhesap")}
            >
              Bizim Hesap ile öde
            </button>
          </footer>
        </div>
      ) : null}

      <div className="card">
        <header>
          <h3>Başvuru özeti</h3>
        </header>
        <section>
          <pre className="text-xs overflow-auto rounded-lg border bg-muted/30 p-3 max-h-64">
            {survey}
          </pre>
        </section>
      </div>

      <div className="card">
        <header>
          <h3>Notlar</h3>
          <p>Ekibinizle yazışma geçmişi</p>
        </header>
        <section className="grid gap-4">
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
              <textarea
                id="note"
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Sorunuz veya ek bilginiz..."
              />
            </FormField>
            <button type="submit" className="btn self-start" data-size="sm" disabled={noteSaving}>
              {noteSaving ? "Kaydediliyor..." : "Not gönder"}
            </button>
          </form>
        </section>
      </div>

      <button type="button" className="btn" data-variant="outline" onClick={() => router.refresh()}>
        Yenile
      </button>
    </div>
  );
}
