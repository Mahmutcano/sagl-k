"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import { hasErrors, type FieldErrors } from "@/lib/validation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, FormSelect, TextInput } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Layers, Plus, Search, X, ChevronLeft, ChevronRight } from "lucide-react";

type Profession = {
  id: string;
  code: string;
  name: string;
  targetInstitution: number;
  hospitalId: string | null;
  hospitalName?: string;
  isActive: boolean;
};

type Hospital = {
  id: string;
  name: string;
  code: string;
};

const NO_HOSPITAL = "_none";

export default function AdminDepartmentsPage() {
  const router = useRouter();
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    targetInstitution: 1,
    hospitalId: "",
    isActive: true,
  });
  const [fields, setFields] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);

    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search: searchQuery.trim(),
    }).toString();

    Promise.all([
      api<{ items: Profession[]; totalCount: number }>(`${API.admin.professions}?${query}`, {}, token),
      api<Hospital[]>(API.admin.hospitals, {}, token),
    ])
      .then(([p, h]) => {
        let items = p?.items ?? [];
        if (hospitalFilter === NO_HOSPITAL) {
          items = items.filter((x) => !x.hospitalId);
        } else if (hospitalFilter) {
          items = items.filter((x) => x.hospitalId === hospitalFilter);
        }
        setProfessions(items);
        setTotalCount(p?.totalCount ?? 0);
        setHospitals(h ?? []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [page, pageSize, searchQuery, hospitalFilter]);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace(ROUTES.admin.login);
      return;
    }
    loadData();
  }, [router, loadData]);

  function handleOpenAdd() {
    setEditingId(null);
    setForm({ code: "", name: "", targetInstitution: 1, hospitalId: "", isActive: true });
    setFields({});
    setFormError("");
    setIsModalOpen(true);
  }

  function handleOpenEdit(p: Profession) {
    setEditingId(p.id);
    setForm({
      code: p.code,
      name: p.name,
      targetInstitution: p.targetInstitution || 1,
      hospitalId: p.hospitalId || "",
      isActive: p.isActive !== false,
    });
    setFields({});
    setFormError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const f: FieldErrors = {};
    if (!form.code.trim()) f.code = "Branş kodu zorunludur.";
    if (!form.name.trim()) f.name = "Branş adı zorunludur.";
    if (form.targetInstitution < 1 || form.targetInstitution > 99) {
      f.targetInstitution = "Hedef kurum kodu 1–99 arasında olmalıdır.";
    }
    setFields(f);
    if (hasErrors(f)) return;

    const token = getToken();
    if (!token) return;
    setSaving(true);

    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      targetInstitution: form.targetInstitution,
      hospitalId: form.hospitalId || "",
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await api(API.admin.professionUpdate(editingId), { method: "PUT", body: JSON.stringify(body) }, token);
        setSuccessMsg("Klinik bölüm/branş güncellendi.");
      } else {
        await api(API.admin.createProfession, { method: "POST", body: JSON.stringify(body) }, token);
        setSuccessMsg("Klinik bölüm/branş oluşturuldu.");
      }
      setIsModalOpen(false);
      loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length > 0) setFields(err.fields);
        setFormError(err.message);
      } else {
        setFormError(editingId ? "Bölüm güncellenemedi." : "Bölüm oluşturulamadı.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminAppShell
      title="Bölüm & Branş Yönetimi"
      description="Uzman hekimlerin bağlı olduğu klinik branşları ve hastane ilişkilerini yapılandırın"
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {successMsg ? (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 shadow-sm">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex min-w-0 flex-col justify-between gap-3 md:mb-6 md:flex-row md:items-end">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setSearchQuery(searchText);
          }}
          className="admin-filter-bar min-w-0 flex-grow space-y-3 rounded-xl border bg-white p-3 sm:rounded-2xl sm:p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="search" className="text-xs font-semibold">
                Arama
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  className="h-10 rounded-xl pl-9"
                  placeholder="Bölüm adı veya kod"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>
            <FormSelect
              id="hospitalFilter"
              label="Hastane"
              value={hospitalFilter || undefined}
              onChange={(e) => {
                setPage(0);
                setHospitalFilter(e.target.value);
              }}
              placeholder="Tüm hastaneler"
              options={[
                { value: NO_HOSPITAL, label: "Genel / Bağımsız" },
                ...hospitals.map((h) => ({ value: h.id, label: h.name })),
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" className="h-9 gap-1.5 rounded-xl px-4 font-semibold">
              <Search className="h-4 w-4" />
              Ara
            </Button>
            {(searchQuery || searchText || hospitalFilter) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-xl"
                onClick={() => {
                  setSearchText("");
                  setSearchQuery("");
                  setHospitalFilter("");
                  setPage(0);
                }}
              >
                Temizle
              </Button>
            )}
          </div>
        </form>

        <Button onClick={handleOpenAdd} className="h-10 gap-1.5 self-end rounded-xl px-5 font-bold">
          <Plus className="h-4 w-4" />
          Branş Ekle
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : professions.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-white p-12 text-center text-sm italic text-muted-foreground shadow-sm">
          Tanımlı klinik bölüm bulunamadı.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden rounded-xl bg-white/95 sm:rounded-2xl">
            <CardHeader className="border-b bg-muted/40 px-3 py-3 sm:px-6 sm:py-5">
              <CardTitle className="flex items-center gap-2 text-sm font-bold sm:text-base">
                <Layers className="h-5 w-5 text-primary" />
                Bölümler & Klinik Branşlar
              </CardTitle>
              <CardDescription className="text-xs">Sistemdeki klinik çalışma alanları</CardDescription>
            </CardHeader>
            <CardContent className="admin-table-scroll p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Bölüm Adı
                    </TableHead>
                    <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Kod
                    </TableHead>
                    <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Hastane
                    </TableHead>
                    <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Durum
                    </TableHead>
                    <TableHead className="py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      İşlem
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {professions.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell className="py-4 font-semibold">{p.name}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="font-mono text-xs">
                          {p.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-xs text-muted-foreground">
                        {p.hospitalName || "Genel / Bağımsız"}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() => handleOpenEdit(p)}
                          aria-label="Düzenle"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="mt-2 flex flex-col items-center justify-between gap-4 rounded-2xl border bg-muted/40 px-6 py-4 sm:flex-row">
            <div className="text-xs font-semibold text-muted-foreground">
              Toplam <span className="font-bold text-primary">{totalCount}</span> branş
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 w-8 rounded-lg p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs font-bold">{page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * pageSize >= totalCount}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 w-8 rounded-lg p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white shadow-2xl">
            <form onSubmit={handleSubmit} noValidate>
              <CardHeader className="relative border-b pb-4">
                <CardTitle className="text-base font-bold">
                  {editingId ? "Bölüm Düzenle" : "Bölüm (Branş) Ekle"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Hastaneye bağlı veya genel klinik bölüm tanımlayın.
                </CardDescription>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-4 rounded-full p-1"
                  onClick={() => setIsModalOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>

              <CardContent className="flex flex-col gap-4 pt-6">
                {formError ? <FormAlert title="Hata" message={formError} /> : null}

                <TextInput
                  id="name"
                  label="Branş Adı"
                  placeholder="Örn: Kardiyoloji"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={fields.name}
                />

                <TextInput
                  id="code"
                  label="Branş Kodu"
                  placeholder="Örn: kardiyoloji"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  error={fields.code}
                  disabled={!!editingId}
                />

                <TextInput
                  id="targetInstitution"
                  label="Hedef Kurum Kodu (1-99)"
                  type="number"
                  min={1}
                  max={99}
                  value={String(form.targetInstitution)}
                  onChange={(e) => setForm((f) => ({ ...f, targetInstitution: Number(e.target.value) }))}
                  error={fields.targetInstitution}
                />

                <FormSelect
                  id="hospitalId"
                  label="Bağlı Olduğu Hastane"
                  placeholder="Genel / Bağımsız"
                  value={form.hospitalId || NO_HOSPITAL}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      hospitalId: e.target.value === NO_HOSPITAL ? "" : e.target.value,
                    }))
                  }
                  options={[
                    { value: NO_HOSPITAL, label: "Genel / Bağımsız" },
                    ...hospitals.map((h) => ({ value: h.id, label: h.name })),
                  ]}
                />

                {editingId ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    />
                    Aktif
                  </label>
                ) : null}
              </CardContent>

              <CardFooter className="flex justify-end gap-2 border-t bg-muted/40 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl font-bold"
                >
                  İptal
                </Button>
                <Button type="submit" size="sm" disabled={saving} className="rounded-xl font-bold">
                  {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Kaydet"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </AdminAppShell>
  );
}
