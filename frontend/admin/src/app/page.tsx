"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  api,
  clearAuth,
  getToken,
  getUser,
  isAdminRole,
} from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  hasErrors,
  validateHospitalCode,
  validateHospitalName,
  type FieldErrors,
} from "@/lib/validation";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/AdminNav";
import { FormAlert, TextInput } from "@/components/FormField";
import Link from "next/link";
import { STATUS_LABELS, statusVariant } from "@/lib/application";

type AppRow = {
  applicationId: string;
  statusCode: number;
  patientName: string;
  ecommerceNumber?: string;
};

type Hospital = {
  id: string;
  name: string;
  code: string;
  targetInstitution: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [erciyesHealth, setErciyesHealth] = useState<{
    mode: string;
    healthy: boolean;
    targetInstitution: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [hospitalForm, setHospitalForm] = useState({
    code: "",
    name: "",
    targetInstitution: 1,
  });
  const [hospitalFields, setHospitalFields] = useState<FieldErrors>({});
  const [hospitalMsg, setHospitalMsg] = useState("");
  const [hospitalOk, setHospitalOk] = useState(false);
  const [saving, setSaving] = useState(false);

  function load(token: string) {
    return Promise.all([
      api<AppRow[]>(API.admin.applications, {}, token),
      api<Hospital[]>(API.admin.hospitals, {}, token),
      api<{ mode: string; healthy: boolean; targetInstitution: number }>(
        API.admin.erciyesHealth,
        {},
        token
      ).catch(() => null),
    ]).then(([a, h, e]) => {
      setApps(a ?? []);
      setHospitals(h ?? []);
      setErciyesHealth(e);
    });
  }

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace("/login");
      return;
    }
    load(token)
      .catch((err) => {
        if (
          err instanceof ApiError &&
          (err.code === "AUTH001" || err.code === "AUTH002" || err.code === "AUTH004")
        ) {
          clearAuth();
          router.replace("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function createHospital(e: React.FormEvent) {
    e.preventDefault();
    setHospitalMsg("");
    setHospitalOk(false);
    const fields: FieldErrors = {};
    const codeErr = validateHospitalCode(hospitalForm.code);
    if (codeErr) fields.code = codeErr;
    const nameErr = validateHospitalName(hospitalForm.name);
    if (nameErr) fields.name = nameErr;
    if (hospitalForm.targetInstitution < 1 || hospitalForm.targetInstitution > 99) {
      fields.targetInstitution = "Hedef kurum kodu 1–99 arasında olmalıdır.";
    }
    setHospitalFields(fields);
    if (hasErrors(fields)) return;

    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await api(
        API.admin.hospitals,
        { method: "POST", body: JSON.stringify(hospitalForm) },
        token
      );
      setHospitalForm({ code: "", name: "", targetInstitution: 1 });
      setHospitalMsg("Hastane başarıyla oluşturuldu.");
      setHospitalOk(true);
      await load(token);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length) setHospitalFields(err.fields);
        setHospitalMsg(err.message);
      } else {
        setHospitalMsg("Hastane oluşturulamadı.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Yönetim paneli"
      description="Hastaneler, başvurular ve operasyonel özet"
    >
      <AdminNav />
      {error ? <FormAlert title="Hata" message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card" data-size="sm">
          <header>
            <h3>Hastaneler</h3>
            <p>Kayıtlı kurum</p>
          </header>
          <section>
            <p className="text-2xl font-semibold">{loading ? "—" : hospitals.length}</p>
          </section>
        </div>
        <div className="card" data-size="sm">
          <header>
            <h3>Başvurular</h3>
            <p>Son kayıtlar</p>
          </header>
          <section>
            <p className="text-2xl font-semibold">{loading ? "—" : apps.length}</p>
          </section>
        </div>
        <div className="card" data-size="sm">
          <header>
            <h3>Erciyes HIS</h3>
            <p>Web servisi</p>
          </header>
          <section className="flex flex-col gap-2">
            {loading || !erciyesHealth ? (
              <span className="badge" data-variant="outline">
                —
              </span>
            ) : (
              <>
                <span
                  className="badge"
                  data-variant={erciyesHealth.healthy ? "default" : "destructive"}
                >
                  {erciyesHealth.healthy ? "Bağlı" : "Erişilemiyor"}
                </span>
                <span className="text-muted-foreground text-xs">
                  mod: {erciyesHealth.mode} · kurum: {erciyesHealth.targetInstitution}
                </span>
              </>
            )}
          </section>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <header>
            <h2>Hastaneler</h2>
            <p>Sistemde tanımlı kurumlar</p>
          </header>
          <section>
            {loading ? (
              <div className="space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            ) : hospitals.length === 0 ? (
              <div className="empty py-6">
                <header>
                  <h3>Hastane yok</h3>
                  <p>Sağdaki formdan ilk kurumu ekleyin.</p>
                </header>
              </div>
            ) : (
              <ul className="grid gap-2">
                {hospitals.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{h.name}</span>
                    <span className="badge" data-variant="secondary">
                      {h.code}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <form onSubmit={createHospital} className="card" noValidate>
          <header>
            <h2>Hastane ekle</h2>
            <p>Alanlar istemci ve sunucuda doğrulanır.</p>
          </header>
          <section className="flex flex-col gap-4">
            {hospitalMsg ? (
              <FormAlert
                title={hospitalOk ? "Başarılı" : "Uyarı"}
                message={hospitalMsg}
                variant={hospitalOk ? "default" : "destructive"}
              />
            ) : null}
            <TextInput
              id="code"
              label="Kod"
              hint="2–32 karakter, benzersiz"
              placeholder="ORN-01"
              value={hospitalForm.code}
              onChange={(e) => setHospitalForm((f) => ({ ...f, code: e.target.value }))}
              error={hospitalFields.code}
            />
            <TextInput
              id="name"
              label="Ad"
              placeholder="Örnek Hastanesi"
              value={hospitalForm.name}
              onChange={(e) => setHospitalForm((f) => ({ ...f, name: e.target.value }))}
              error={hospitalFields.name}
            />
            <TextInput
              id="targetInstitution"
              label="Hedef kurum"
              type="number"
              min={1}
              max={99}
              hint="1–99 arası kurum kodu"
              value={String(hospitalForm.targetInstitution)}
              onChange={(e) =>
                setHospitalForm((f) => ({
                  ...f,
                  targetInstitution: Number(e.target.value),
                }))
              }
              error={hospitalFields.targetInstitution}
            />
          </section>
          <footer className="border-t">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Hastaneyi kaydet"}
            </button>
          </footer>
        </form>
      </div>

      <div className="card">
        <header>
          <h2>Başvurular</h2>
          <p>Son 100 başvuru kaydı</p>
        </header>
        <section>
          {loading ? (
            <div className="space-y-2">
              <div className="skeleton h-8 w-full" />
              <div className="skeleton h-8 w-full" />
            </div>
          ) : apps.length === 0 ? (
            <div className="empty py-8">
              <header>
                <h3>Başvuru yok</h3>
                <p>Hasta başvuruları burada listelenir.</p>
              </header>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Hasta</th>
                    <th>No</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.applicationId}>
                      <td>
                        <Link
                          href={`/applications/${a.applicationId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {a.patientName}
                        </Link>
                      </td>
                      <td>{a.ecommerceNumber ?? "—"}</td>
                      <td>
                        <span className="badge" data-variant={statusVariant(a.statusCode)}>
                          {STATUS_LABELS[a.statusCode] ?? a.statusCode}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
