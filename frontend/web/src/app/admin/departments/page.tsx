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
import { Layers, Plus, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function AdminDepartmentsPage() {
  const router = useRouter();
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Pagination & Filtering
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    targetInstitution: 1,
    hospitalId: "",
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
        setProfessions(p?.items ?? []);
        setTotalCount(p?.totalCount ?? 0);
        setHospitals(h ?? []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [page, pageSize, searchQuery]);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchText);
  };

  const handleClearFilters = () => {
    setSearchText("");
    setSearchQuery("");
    setPage(0);
  };

  function handleOpenAdd() {
    setForm({ code: "", name: "", targetInstitution: 1, hospitalId: "" });
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

    try {
      await api(
        API.admin.createProfession,
        {
          method: "POST",
          body: JSON.stringify({
            code: form.code.trim(),
            name: form.name.trim(),
            targetInstitution: form.targetInstitution,
            hospitalId: form.hospitalId || undefined,
          }),
        },
        token
      );
      setSuccessMsg("Klinik bölüm/branş başarıyla oluşturuldu.");
      setIsModalOpen(false);
      loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Bölüm oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminAppShell title="Bölüm & Branş Yönetimi" description="Uzman hekimlerin bağlı olduğu klinik branşları ve hastane ilişkilerini yapılandırın">
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {successMsg ? (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-4 text-xs font-semibold mb-6 flex justify-between items-center shadow-sm">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex min-w-0 flex-col justify-between gap-3 print:hidden md:mb-6 md:flex-row md:items-end">
        {/* Premium Filter Area */}
        <form onSubmit={handleSearchSubmit} className="admin-filter-bar min-w-0 flex-grow rounded-xl border border-slate-200/80 bg-white p-3 shadow-premium sm:rounded-2xl sm:p-5">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="search" className="text-xs font-bold text-slate-700 tracking-wide">Arama</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="search"
                className="pl-10 h-10 border-slate-200 focus-visible:ring-primary/20 focus-visible:border-primary bg-white rounded-xl shadow-inner-sm"
                placeholder="Bölüm adı veya kod yazın..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2.5 justify-end mt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters} className="h-9 font-bold hover:bg-slate-100 rounded-xl">
              Temizle
            </Button>
            <Button type="submit" size="sm" className="h-9 gap-1.5 font-bold shadow-md shadow-primary/10 rounded-xl px-5">
              <Search className="h-4 w-4" />
              Ara
            </Button>
          </div>
        </form>

        <Button onClick={handleOpenAdd} className="gap-1.5 shadow-md shadow-primary/10 h-10 self-end font-bold rounded-xl px-5">
          <Plus className="h-4.5 w-4.5" />
          Branş Ekle
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : professions.length === 0 ? (
        <p className="p-12 text-center text-sm text-slate-500 italic bg-white rounded-2xl border border-dashed shadow-sm">
          Tanımlı klinik bölüm bulunamadı.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="shadow-premium overflow-hidden rounded-xl border-slate-200/80 bg-white/95 sm:rounded-2xl">
            <CardHeader className="border-b bg-slate-50/50 px-3 py-3 sm:px-6 sm:py-5">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-800 sm:text-base">
                <Layers className="h-5 w-5 text-primary" />
                Bölümler & Klinik Branşlar
              </CardTitle>
              <CardDescription className="text-xs">Sistemdeki aktif klinik çalışma alanları</CardDescription>
            </CardHeader>
            <CardContent className="admin-table-scroll p-0">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="w-12 text-center py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">#</TableHead>
                    <TableHead className="py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bölüm Adı</TableHead>
                    <TableHead className="py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kod</TableHead>
                    <TableHead className="py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bağlı Hastane</TableHead>
                    <TableHead className="py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hedef Kurum</TableHead>
                    <TableHead className="py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {professions.map((p, i) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-center font-mono text-xs text-slate-400 py-4">{page * pageSize + i + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-800 py-4">{p.name}</TableCell>
                      <TableCell className="py-4"><Badge variant="outline" className="font-mono text-xs font-semibold">{p.code}</Badge></TableCell>
                      <TableCell className="text-slate-600 py-4 text-xs font-semibold">{p.hospitalName || "Genel / Bağımsız"}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500 py-4">{p.targetInstitution}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="default">Aktif</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Premium Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 border border-slate-200/50 rounded-2xl px-6 py-4 mt-2 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 tracking-wide font-sans">
              Toplam <span className="text-primary font-bold">{totalCount}</span> branştan <span className="text-slate-800 font-bold">{page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)}</span> arası gösteriliyor
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all duration-150"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {(() => {
                  const totalPages = Math.ceil(totalCount / pageSize);
                  const pages = [];
                  const startPage = Math.max(0, page - 1);
                  const endPage = Math.min(totalPages - 1, page + 1);

                  for (let i = startPage; i <= endPage; i++) {
                    const active = i === page;
                    pages.push(
                      <Button
                        key={i}
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(i)}
                        className={cn(
                          "h-8 min-w-[32px] px-2 text-xs font-bold rounded-lg transition-all duration-150",
                          active 
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10" 
                            : "border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        {i + 1}
                      </Button>
                    );
                  }
                  return pages;
                })()}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * pageSize >= totalCount}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all duration-150"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Department Add Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-slate-200 bg-white">
            <form onSubmit={handleSubmit} noValidate>
              <CardHeader className="relative border-b pb-4">
                <CardTitle className="text-base text-slate-800 font-bold">
                  Bölüm (Branş) Ekle
                </CardTitle>
                <CardDescription className="text-xs">
                  Hastaneye bağlı veya genel klinik bölüm/branş tanımlayın.
                </CardDescription>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-4 p-1 rounded-full hover:bg-slate-200"
                  onClick={() => setIsModalOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>

              <CardContent className="pt-6 flex flex-col gap-4">
                {formError ? <FormAlert title="Hata" message={formError} /> : null}

                <TextInput
                  id="name"
                  label="Branş Adı"
                  placeholder="Örn: Kardiyoloji veya Göz Hastalıkları"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={fields.name}
                />

                <TextInput
                  id="code"
                  label="Branş Kodu"
                  placeholder="Örn: kardiyoloji veya goz"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  error={fields.code}
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
                  label="Bağlı Olduğu Hastane (İsteğe bağlı)"
                  placeholder="Genel / Hastaneden bağımsız"
                  value={form.hospitalId}
                  onChange={(e) => setForm((f) => ({ ...f, hospitalId: e.target.value }))}
                  options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
                />
              </CardContent>

              <CardFooter className="border-t pt-4 flex gap-2 justify-end bg-slate-50/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={saving} className="font-bold rounded-xl">
                  İptal
                </Button>
                <Button type="submit" size="sm" disabled={saving} className="font-bold rounded-xl">
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </AdminAppShell>
  );
}
