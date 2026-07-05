"use client";

import { ROUTES } from "@/lib/routes";

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
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, FormSelect, TextInput } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Doctor = {
  id: string;
  fullName: string;
  professionCode: string;
  hospitalName?: string | null;
};

type Hospital = { id: string; name: string; code: string };

const NO_HOSPITAL = "_none";

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
    nationalIdentifier: "",
    email: "",
    phoneNumber: "",
    password: "",
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
      router.replace(ROUTES.admin.login);
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
    if (!/^\d{11}$/.test(form.nationalIdentifier.trim())) {
      f.nationalIdentifier = "Geçerli 11 haneli TC Kimlik No giriniz.";
    }
    if (!form.email.trim() || !form.email.includes("@")) f.email = "Geçerli e-posta giriniz.";
    if (!form.phoneNumber.trim()) f.phoneNumber = "Telefon zorunludur.";
    if (form.password.length < 8) f.password = "Şifre en az 8 karakter olmalıdır.";
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
            nationalIdentifier: form.nationalIdentifier.trim(),
            email: form.email.trim(),
            phoneNumber: form.phoneNumber.trim(),
            password: form.password,
          }),
        },
        token
      );
      setForm({
        fullName: "",
        professionCode: "cardiology",
        targetInstitution: 1,
        hospitalId: "",
        nationalIdentifier: "",
        email: "",
        phoneNumber: "",
        password: "",
      });
      setMsg("Doktor hesabı oluşturuldu.");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminAppShell title="Doktorlar" description="Kurum doktor kayıtları">
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Başarılı" message={msg} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kayıtlı doktorlar</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : doctors.length === 0 ? (
              <p className="text-muted-foreground text-sm">Doktor yok.</p>
            ) : (
              <ul className="grid gap-2">
                {doctors.map((d) => (
                  <li key={d.id} className="flex justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                    <span className="font-medium">{d.fullName}</span>
                    <Badge variant="secondary">{d.professionCode}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <form onSubmit={submit} noValidate>
            <CardHeader>
              <CardTitle>Doktor ekle</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
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
              <TextInput
                id="nationalIdentifier"
                label="TC Kimlik No"
                inputMode="numeric"
                maxLength={11}
                value={form.nationalIdentifier}
                onChange={(e) => setForm((f) => ({ ...f, nationalIdentifier: e.target.value }))}
                error={fields.nationalIdentifier}
              />
              <TextInput
                id="email"
                label="E-posta"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                error={fields.email}
              />
              <TextInput
                id="phoneNumber"
                label="Telefon"
                inputMode="tel"
                placeholder="5xxxxxxxxx"
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                error={fields.phoneNumber}
              />
              <TextInput
                id="password"
                label="Giriş şifresi"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                error={fields.password}
              />
              <FormSelect
                id="hospitalId"
                label="Hastane"
                placeholder="Seçiniz (isteğe bağlı)"
                value={form.hospitalId || NO_HOSPITAL}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    hospitalId: e.target.value === NO_HOSPITAL ? "" : e.target.value,
                  }))
                }
                options={[
                  { value: NO_HOSPITAL, label: "Seçiniz (isteğe bağlı)" },
                  ...hospitals.map((h) => ({ value: h.id, label: h.name })),
                ]}
              />
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AdminAppShell>
  );
}
