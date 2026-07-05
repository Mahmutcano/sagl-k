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
import { hasErrors, validatePersonName, type FieldErrors } from "@/lib/validation";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/AdminNav";
import { FormAlert, TextInput } from "@/components/FormField";

type Doctor = {
  id: string;
  fullName: string;
  professionCode: string;
  hospitalName?: string | null;
};

type Hospital = { id: string; name: string; code: string };

export default function AdminDoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    fullName: "",
    professionCode: "cardiology",
    targetInstitution: 1,
    hospitalId: "",
  });

  function load(token: string) {
    return Promise.all([
      api<Doctor[]>(API.admin.doctors, {}, token),
      api<Hospital[]>(API.admin.hospitals, {}, token),
    ]).then(([d, h]) => {
      setDoctors(d ?? []);
      setHospitals(h ?? []);
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
      .catch((err) => setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const f: FieldErrors = {};
    const nameErr = validatePersonName(form.fullName, "Doktor adı");
    if (nameErr) f.fullName = nameErr;
    if (!form.professionCode.trim()) f.professionCode = "Branş kodu zorunludur.";
    setFields(f);
    if (hasErrors(f)) return;

    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      await api(
        API.admin.doctors,
        {
          method: "POST",
          body: JSON.stringify({
            fullName: form.fullName,
            professionCode: form.professionCode,
            targetInstitution: form.targetInstitution,
            hospitalId: form.hospitalId || undefined,
          }),
        },
        token
      );
      setForm({ fullName: "", professionCode: "cardiology", targetInstitution: 1, hospitalId: "" });
      setMsg("Doktor kaydı oluşturuldu.");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Doktorlar" description="Kurum doktor kayıtları">
      <AdminNav />
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Başarılı" message={msg} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <header>
            <h2>Kayıtlı doktorlar</h2>
          </header>
          <section>
            {loading ? (
              <div className="skeleton h-20 w-full" />
            ) : doctors.length === 0 ? (
              <p className="text-muted-foreground text-sm">Doktor yok.</p>
            ) : (
              <ul className="grid gap-2">
                {doctors.map((d) => (
                  <li key={d.id} className="flex justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                    <span className="font-medium">{d.fullName}</span>
                    <span className="badge" data-variant="secondary">
                      {d.professionCode}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <form onSubmit={submit} className="card" noValidate>
          <header>
            <h2>Doktor ekle</h2>
          </header>
          <section className="grid gap-3">
            <TextInput
              id="fullName"
              label="Ad soyad"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              error={fields.fullName}
            />
            <TextInput
              id="professionCode"
              label="Branş kodu"
              hint="ör. cardiology"
              value={form.professionCode}
              onChange={(e) => setForm((f) => ({ ...f, professionCode: e.target.value }))}
              error={fields.professionCode}
            />
            <FormField id="hospitalId" label="Hastane">
              <select
                id="hospitalId"
                value={form.hospitalId}
                onChange={(e) => setForm((f) => ({ ...f, hospitalId: e.target.value }))}
              >
                <option value="">Seçiniz (isteğe bağlı)</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </FormField>
          </section>
          <footer className="border-t">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </footer>
        </form>
      </div>
    </AppShell>
  );
}

function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
