"use client";

import { ROUTES } from "@/lib/routes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { hasErrors, validatePersonName, type FieldErrors } from "@/lib/validation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, FormSelect, TextInput } from "@/components/FormField";
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

type Doctor = {
  id: string;
  fullName: string;
  title: string;
  professionCode: string;
  hospitalName?: string | null;
  isActive: boolean;
};

type Hospital = { id: string; name: string; code: string };
type Profession = { id: string; name: string; code: string };

const NO_HOSPITAL = "_none";

const TITLES = [
  { value: "Prof. Dr.", label: "Prof. Dr." },
  { value: "Doç. Dr.", label: "Doç. Dr." },
  { value: "Dr. Öğr. Üyesi", label: "Dr. Öğr. Üyesi" },
  { value: "Uzm. Dr.", label: "Uzm. Dr." },
  { value: "Dr.", label: "Dr." },
];

export default function AdminDoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});

  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    title: "Prof. Dr.",
    professionCodes: [] as string[],
    targetInstitution: 1,
    hospitalId: "",
    nationalIdentifier: "",
    email: "",
    phoneNumber: "",
    password: "",
    consultationFee: 1000,
    isActive: true,
  });

  function load(token: string) {
    return Promise.all([
      api<Doctor[]>(API.admin.doctors, {}, token),
      api<Hospital[]>(API.admin.hospitals, {}, token),
      api<Profession[]>(API.admin.professions, {}, token),
    ]).then(([d, h, p]) => {
      setDoctors(d ?? []);
      setHospitals(h ?? []);
      setProfessions(p ?? []);
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

  function handleProfessionToggle(code: string) {
    setForm((prev) => {
      const exists = prev.professionCodes.includes(code);
      if (exists) {
        return {
          ...prev,
          professionCodes: prev.professionCodes.filter((c) => c !== code),
        };
      } else {
        return {
          ...prev,
          professionCodes: [...prev.professionCodes, code],
        };
      }
    });
  }

  async function handleEditClick(doc: Doctor) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const details = await api<{
        id: string;
        fullName: string;
        title: string;
        professionCodes: string[];
        targetInstitution: number;
        hospitalId: string;
        nationalIdentifier: string;
        email: string;
        phoneNumber: string;
        consultationFee: number;
        isActive: boolean;
      }>(API.admin.doctorDetail(doc.id), {}, token);

      setEditingId(details.id);
      setForm({
        fullName: details.fullName,
        title: details.title || "Prof. Dr.",
        professionCodes: details.professionCodes || [],
        targetInstitution: details.targetInstitution || 1,
        hospitalId: details.hospitalId || "",
        nationalIdentifier: details.nationalIdentifier || "",
        email: details.email || "",
        phoneNumber: details.phoneNumber || "",
        password: "", // Leave blank unless changing
        consultationFee: details.consultationFee || 1000,
        isActive: details.isActive,
      });
      setFields({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Doktor detayları alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm({
      fullName: "",
      title: "Prof. Dr.",
      professionCodes: [],
      targetInstitution: 1,
      hospitalId: "",
      nationalIdentifier: "",
      email: "",
      phoneNumber: "",
      password: "",
      consultationFee: 1000,
      isActive: true,
    });
    setFields({});
    setMsg("");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const f: FieldErrors = {};
    const nameErr = validatePersonName(form.fullName, "Doktor adı");
    if (nameErr) f.fullName = nameErr;
    if (form.professionCodes.length === 0) f.professionCodes = "En az bir branş seçilmelidir.";
    if (!/^\d{11}$/.test(form.nationalIdentifier.trim())) {
      f.nationalIdentifier = "Geçerli 11 haneli TC Kimlik No giriniz.";
    }
    if (!form.email.trim() || !form.email.includes("@")) f.email = "Geçerli e-posta giriniz.";
    if (!form.phoneNumber.trim()) f.phoneNumber = "Telefon zorunludur.";
    if (!editingId && form.password.length < 8) {
      f.password = "Şifre en az 8 karakter olmalıdır.";
    }
    if (form.consultationFee <= 0) f.consultationFee = "Muayene ücreti 0'dan büyük olmalıdır.";

    setFields(f);
    if (hasErrors(f)) return;

    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    setMsg("");

    const payload = {
      fullName: form.fullName.trim(),
      title: form.title,
      professionCodes: form.professionCodes,
      targetInstitution: form.targetInstitution,
      hospitalId: form.hospitalId || undefined,
      nationalIdentifier: form.nationalIdentifier.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
      password: form.password || undefined,
      consultationFee: Number(form.consultationFee),
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await api(
          API.admin.doctorUpdate(editingId),
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
          token
        );
        setMsg("Doktor bilgileri güncellendi.");
        handleCancelEdit();
      } else {
        await api(
          API.admin.doctors,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token
        );
        setMsg("Doktor hesabı başarıyla oluşturuldu.");
        handleCancelEdit();
      }
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşlem başarısız.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminAppShell title="Doktor Yönetimi" description="Sistemde tanımlı uzman hekimler ve ayarları">
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Başarılı" message={msg} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Doctor List (takes 2 columns) */}
        <div className="lg:col-span-2">
          <Card className="shadow-md border-slate-200">
            <CardHeader>
              <CardTitle>Uzman Hekimler</CardTitle>
              <CardDescription>Sistemdeki tüm hekimler ve çalışma bilgileri</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : doctors.length === 0 ? (
                <p className="text-muted-foreground text-sm italic text-center py-6">Kayıtlı doktor bulunamadı.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b bg-muted/30 text-muted-foreground text-xs uppercase font-semibold">
                        <th className="p-3">Hekim</th>
                        <th className="p-3">Hastane</th>
                        <th className="p-3">Branş</th>
                        <th className="p-3">Durum</th>
                        <th className="p-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctors.map((d) => (
                        <tr key={d.id} className="border-b hover:bg-muted/10">
                          <td className="p-3 font-medium">
                            {d.title ? `${d.title} ` : ""}{d.fullName}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {d.hospitalName || "—"}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">
                              {d.professionCode}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={d.isActive ? "default" : "secondary"}>
                              {d.isActive ? "Aktif" : "Pasif"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(d)}
                              className="text-xs hover:text-primary"
                            >
                              Düzenle
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Doctor Add/Edit Form (takes 1 column) */}
        <div>
          <Card className="shadow-md border-slate-200 sticky top-4">
            <form onSubmit={submit} className="flex flex-col h-full" noValidate>
              <CardHeader>
                <CardTitle>{editingId ? "Hekim Düzenle" : "Doktor Ekle"}</CardTitle>
                <CardDescription>
                  {editingId ? "Hekim detaylarını güncelleyin." : "Yeni hekim kaydı oluşturun."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
                <TextInput
                  id="fullName"
                  label="Ad Soyad"
                  placeholder="Prof. Dr. Olmadan Ad Soyad"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  error={fields.fullName}
                />
                
                <FormSelect
                  id="title"
                  label="Unvan (Title)"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  options={TITLES}
                />

                <TextInput
                  id="consultationFee"
                  label="Muayene Ücreti (₺)"
                  type="number"
                  min={1}
                  value={String(form.consultationFee)}
                  onChange={(e) => setForm((f) => ({ ...f, consultationFee: Number(e.target.value) }))}
                  error={fields.consultationFee}
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
                  placeholder="doctor@hastane.com"
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
                  label={editingId ? "Şifre Değiştir (İsteğe Bağlı)" : "Giriş Şifresi"}
                  type="password"
                  placeholder={editingId ? "Aynı kalması için boş bırakın" : "••••••••"}
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
                    { value: NO_HOSPITAL, label: "Hastanesiz / Kurum Dışı" },
                    ...hospitals.map((h) => ({ value: h.id, label: h.name })),
                  ]}
                />

                {/* Multi-specialty / Department Selection */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-foreground">
                    Klinik Bölümler (Branşlar)
                  </label>
                  {fields.professionCodes && (
                    <p className="text-[11px] font-medium text-destructive">{fields.professionCodes}</p>
                  )}
                  <div className="max-h-[160px] overflow-y-auto border rounded-md p-2 bg-muted/10 grid gap-1.5">
                    {professions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Kayıtlı branş bulunamadı.</span>
                    ) : (
                      professions.map((p) => {
                        const checked = form.professionCodes.includes(p.code);
                        return (
                          <div key={p.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`prof-${p.code}`}
                              checked={checked}
                              onChange={() => handleProfessionToggle(p.code)}
                              className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            />
                            <label
                              htmlFor={`prof-${p.code}`}
                              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                            >
                              {p.name}
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {editingId && (
                  <div className="flex items-center space-x-2 py-1">
                    <input
                      type="checkbox"
                      id="doc-isActive"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="doc-isActive"
                      className="text-xs font-semibold leading-none cursor-pointer"
                    >
                      Hekim Aktif / Görünür
                    </label>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4 flex gap-2 justify-end">
                {editingId && (
                  <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                    Vazgeç
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Kaydet"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </AdminAppShell>
  );
}
