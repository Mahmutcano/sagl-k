"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import { hasErrors, validateHospitalCode, validateHospitalName, type FieldErrors } from "@/lib/validation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, TextInput } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Edit, Plus, X } from "lucide-react";

type Hospital = {
  id: string;
  name: string;
  code: string;
  targetInstitution: number;
  isActive: boolean;
};

export default function AdminHospitalsPage() {
  const router = useRouter();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    targetInstitution: 1,
    isActive: true,
  });
  const [fields, setFields] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function load(token: string) {
    return api<Hospital[]>(API.admin.hospitals, {}, token)
      .then((rows) => setHospitals(rows ?? []));
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
      .catch((err) => setError(err instanceof ApiError ? err.message : "Hastaneler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  function handleOpenAdd() {
    setEditingId(null);
    setForm({ code: "", name: "", targetInstitution: 1, isActive: true });
    setFields({});
    setFormError("");
    setIsModalOpen(true);
  }

  function handleOpenEdit(h: Hospital) {
    setEditingId(h.id);
    setForm({
      code: h.code,
      name: h.name,
      targetInstitution: h.targetInstitution,
      isActive: h.isActive,
    });
    setFields({});
    setFormError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const f: FieldErrors = {};
    const codeErr = validateHospitalCode(form.code);
    if (codeErr) f.code = codeErr;
    const nameErr = validateHospitalName(form.name);
    if (nameErr) f.name = nameErr;
    if (form.targetInstitution < 1 || form.targetInstitution > 99) {
      f.targetInstitution = "Hedef kurum kodu 1–99 arasında olmalıdır.";
    }
    setFields(f);
    if (hasErrors(f)) return;

    const token = getToken();
    if (!token) return;
    setSaving(true);

    try {
      if (editingId) {
        // Edit hospital
        await api(
          API.admin.hospitalUpdate(editingId),
          {
            method: "PUT",
            body: JSON.stringify(form),
          },
          token
        );
        setSuccessMsg("Hastane bilgileri güncellendi.");
      } else {
        // Create hospital
        await api(
          API.admin.hospitals,
          {
            method: "POST",
            body: JSON.stringify({
              code: form.code,
              name: form.name,
              targetInstitution: form.targetInstitution,
            }),
          },
          token
        );
        setSuccessMsg("Yeni hastane başarıyla eklendi.");
      }
      setIsModalOpen(false);
      await load(token);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "İşlem gerçekleştirilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminAppShell
      title="Hastane Yönetimi"
      description="Sistemdeki tüm kurum ve hastane kayıtlarını yönetin, aktif/pasif edin"
      actions={
        <Button onClick={handleOpenAdd} size="sm" className="gap-1.5 font-semibold">
          <Plus className="h-4 w-4" />
          Yeni Hastane Ekle
        </Button>
      }
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {successMsg ? (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg p-4 text-xs font-semibold">
          {successMsg}
        </div>
      ) : null}

      <Card className=" ">
        <CardHeader className="bg-muted/40">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Hastaneler & Kurumlar
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : hospitals.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground italic text-center">Tanımlı hastane bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Hastane Adı</TableHead>
                  <TableHead>Kurum Kodu</TableHead>
                  <TableHead>Hedef Kurum</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hospitals.map((h, i) => (
                  <TableRow key={h.id} className="hover:bg-muted/10">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold text-foreground">{h.name}</TableCell>
                    <TableCell className="font-mono text-xs">{h.code}</TableCell>
                    <TableCell className="font-mono text-xs">{h.targetInstitution}</TableCell>
                    <TableCell>
                      <Badge variant={h.isActive ? "default" : "secondary"}>
                        {h.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(h)}
                        className="text-xs hover:text-primary gap-1"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Düzenle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Hospital Edit/Add Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl bg-white">
            <form onSubmit={handleSubmit} noValidate>
              <CardHeader className="relative border-b pb-4">
                <CardTitle className="text-base text-foreground">
                  {editingId ? "Hastane Düzenle" : "Yeni Hastane Ekle"}
                </CardTitle>
                <CardDescription>
                  {editingId ? "Hastane detaylarını ve görünürlüğünü güncelleyin." : "Sisteme yeni bir kurum entegrasyonu tanımlayın."}
                </CardDescription>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-4 p-1 rounded-full"
                  onClick={() => setIsModalOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>

              <CardContent className="pt-6 flex flex-col gap-4">
                {formError ? <FormAlert title="Hata" message={formError} /> : null}

                <TextInput
                  id="code"
                  label="Hastane Kodu (Tekil)"
                  hint="2–32 karakter, örn: ERC-01"
                  placeholder="ERC-01"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  error={fields.code}
                />

                <TextInput
                  id="name"
                  label="Hastane Adı"
                  placeholder="Erciyes Üniversitesi Tıp Fakültesi"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={fields.name}
                />

                <TextInput
                  id="targetInstitution"
                  label="Hedef Kurum Kodu"
                  type="number"
                  min={1}
                  max={99}
                  hint="Kurum entegrasyon ID değeri (Erciyes için 1)"
                  value={String(form.targetInstitution)}
                  onChange={(e) => setForm((f) => ({ ...f, targetInstitution: Number(e.target.value) }))}
                  error={fields.targetInstitution}
                />

                {editingId && (
                  <div className="flex items-center space-x-2 py-2 border-t mt-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="isActive" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                      Kurum Aktif / Görünür (Hastalara ve hekimlere listelenir)
                    </label>
                  </div>
                )}
              </CardContent>

              <CardContent className="border-t pt-4 flex gap-2 justify-end bg-muted/40">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={saving}>
                  İptal
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Kaydet"}
                </Button>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </AdminAppShell>
  );
}
