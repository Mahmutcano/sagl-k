"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api, getUser } from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  DEFAULT_CONCLUDE_REPORT,
  DEFAULT_REPORT_DRAFT,
  STATUS_LABELS,
  statusVariant,
  type ApplicationDetail,
  type ApplicationNote,
} from "@/lib/application";
import { FormAlert, FormField } from "@/components/FormField";

type Props = {
  id: string;
  token: string;
  backHref?: string;
};

export function StaffApplicationDetail({ id, token, backHref = "/dashboard" }: Props) {
  const user = getUser();
  const role = user?.role;
  const isNurse = role === "nurse" || role === "admin" || role === "developer";
  const isDoctor = role === "doctor" || role === "admin" || role === "developer";

  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [draft, setDraft] = useState(DEFAULT_REPORT_DRAFT);
  const [concludeJson, setConcludeJson] = useState(DEFAULT_CONCLUDE_REPORT);
  const [rejectReason, setRejectReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [pacsUrl, setPacsUrl] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      api<ApplicationDetail>(API.applications.detail(id), {}, token),
      api<ApplicationNote[]>(API.applications.notes(id), {}, token).catch(() => []),
      isDoctor
        ? api<{ data: string }>(API.applications.reportDraft(id), {}, token).catch(() => ({
            data: DEFAULT_REPORT_DRAFT,
          }))
        : Promise.resolve({ data: DEFAULT_REPORT_DRAFT }),
    ]).then(([detail, noteList, draftRes]) => {
      setApp(detail);
      setNotes(noteList ?? []);
      const d = draftRes.data?.trim();
      if (d && d !== "{}") {
        try {
          setDraft(JSON.stringify(JSON.parse(d), null, 2));
        } catch {
          setDraft(d);
        }
      }
    });
  }, [id, token, isDoctor]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof ApiError ? err.message : "Başvuru yüklenemedi."))
      .finally(() => setLoading(false));
  }, [load]);

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

  async function saveDraft() {
    setBusy(true);
    try {
      JSON.parse(draft);
      await api(API.applications.reportDraft(id), {
        method: "PUT",
        body: JSON.stringify({ data: draft }),
      }, token);
      setMsg("Taslak kaydedildi.");
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Rapor taslağı geçerli JSON olmalıdır.");
      } else {
        setError(err instanceof ApiError ? err.message : "Taslak kaydedilemedi.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function conclude() {
    setBusy(true);
    try {
      JSON.parse(concludeJson);
      await api(API.applications.conclude(id), {
        method: "POST",
        body: JSON.stringify({ reportJson: concludeJson }),
      }, token);
      setMsg("Başvuru sonuçlandırıldı.");
      await load();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Nihai rapor geçerli JSON olmalıdır.");
      } else {
        setError(err instanceof ApiError ? err.message : "Sonuçlandırma başarısız.");
      }
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
      const noteList = await api<ApplicationNote[]>(API.applications.notes(id), {}, token);
      setNotes(noteList ?? []);
      setMsg("Not eklendi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function openPacs() {
    try {
      const res = await api<{ url: string }>(
        `${API.erciyes.pacsUrl}?applicationId=${encodeURIComponent(id)}`,
        {},
        token
      );
      if (res.url) {
        setPacsUrl(res.url);
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "PACS bağlantısı alınamadı.");
    }
  }

  if (loading) {
    return (
      <div className="grid gap-3">
        <div className="skeleton h-8 w-1/2" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  if (!app) return <FormAlert title="Hata" message={error || "Başvuru bulunamadı."} />;

  const survey =
    typeof app.surveyData === "string"
      ? app.surveyData
      : JSON.stringify(app.surveyData ?? {}, null, 2);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={backHref} className="btn" data-variant="ghost" data-size="sm">
          ← Geri
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
          <p>{app.ecommerceNumber ?? app.applicationId}</p>
        </header>
        <section>
          <pre className="text-xs overflow-auto rounded-lg border bg-muted/30 p-3 max-h-48">{survey}</pre>
        </section>
        {isDoctor ? (
          <footer className="border-t">
            <button type="button" className="btn" data-variant="outline" data-size="sm" onClick={openPacs}>
              PACS görüntüleyici
            </button>
            {pacsUrl ? (
              <p className="text-muted-foreground text-xs mt-2 break-all">{pacsUrl}</p>
            ) : null}
          </footer>
        ) : null}
      </div>

      {isNurse && [1, 4, 5, 11].includes(app.statusCode) ? (
        <div className="card">
          <header>
            <h3>Sekreterya değerlendirmesi</h3>
            <p>Onay veya red gerekçesi ile değerlendirin.</p>
          </header>
          <section className="grid gap-3">
            <FormField id="reason" label="Red gerekçesi (red durumunda)">
              <textarea
                id="reason"
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Red sebebini yazın..."
              />
            </FormField>
          </section>
          <footer className="flex flex-wrap gap-2 border-t">
            <button type="button" className="btn" disabled={busy} onClick={() => assess(true)}>
              Onayla
            </button>
            <button
              type="button"
              className="btn"
              data-variant="destructive"
              disabled={busy}
              onClick={() => assess(false)}
            >
              Reddet
            </button>
            <button
              type="button"
              className="btn"
              data-variant="secondary"
              disabled={busy}
              onClick={sendToDoctor}
            >
              Doktora yönlendir
            </button>
          </footer>
        </div>
      ) : null}

      {isDoctor && app.statusCode !== 11 ? (
        <>
          <div className="card">
            <header>
              <h3>Rapor taslağı</h3>
              <p>JSON formatında taslak kaydedin.</p>
            </header>
            <section>
              <textarea
                className="w-full min-h-[160px] font-mono text-xs rounded-lg border p-3"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </section>
            <footer className="border-t">
              <button type="button" className="btn" disabled={busy} onClick={saveDraft}>
                Taslağı kaydet
              </button>
            </footer>
          </div>

          <div className="card">
            <header>
              <h3>Başvuruyu sonuçlandır</h3>
              <p>Nihai raporu JSON olarak gönderin.</p>
            </header>
            <section>
              <textarea
                className="w-full min-h-[160px] font-mono text-xs rounded-lg border p-3"
                value={concludeJson}
                onChange={(e) => setConcludeJson(e.target.value)}
              />
            </section>
            <footer className="border-t">
              <button type="button" className="btn" disabled={busy} onClick={conclude}>
                Sonuçlandır
              </button>
            </footer>
          </div>
        </>
      ) : null}

      <div className="card">
        <header>
          <h3>Notlar</h3>
        </header>
        <section className="grid gap-3">
          {notes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Not yok.</p>
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
          <form onSubmit={addNote} className="flex flex-col gap-2">
            <FormField id="staff-note" label="Not ekle">
              <textarea
                id="staff-note"
                rows={2}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </FormField>
            <button type="submit" className="btn self-start" data-size="sm" disabled={busy}>
              Gönder
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
