"use client";

import { ROUTES } from "@/lib/routes";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { hasErrors, validatePersonName, type FieldErrors } from "@/lib/validation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, FormSelect, TextInput } from "@/components/FormField";
import { PasswordInput } from "@/components/PasswordInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, X, Search, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Doctor = {
  id: string;
  fullName: string;
  title: string;
  professionCode: string;
  hospitalName?: string | null;
  isActive: boolean;
  revenueSharePercent?: number;
};

type Hospital = { id: string; name: string; code: string };
type Profession = { id: string; name: string; code: string };
type DynamicTitle = { id: string; name: string; isActive: boolean };

const NO_HOSPITAL = "_none";

const DEFAULT_TITLES = [
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
  const [dynamicTitles, setDynamicTitles] = useState<DynamicTitle[]>([]);
  
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});

  // Pagination & Filtering
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  // Branch Multiselect Search
  const [profSearch, setProfSearch] = useState("");

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
    revenueSharePercent: 70,
    isActive: true,
    smsEnabled: true,
    emailEnabled: true,
  });

  const loadData = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);

    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search: searchQuery.trim(),
      professionCode: departmentFilter,
    }).toString();

    Promise.all([
      api<{ items: Doctor[]; totalCount: number }>(`${API.admin.doctors}?${query}`, {}, token),
      api<Hospital[]>(API.admin.hospitals, {}, token),
      api<{ items: Profession[] }>(`${API.admin.professions}?pageSize=1000`, {}, token),
      api<DynamicTitle[]>(API.admin.titles, {}, token).catch(() => []),
    ])
      .then(([d, h, p, t]) => {
        setDoctors(d?.items ?? []);
        setTotalCount(d?.totalCount ?? 0);
        setHospitals(h ?? []);
        setProfessions(p?.items ?? []);
        setDynamicTitles(t ?? []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [page, pageSize, searchQuery, departmentFilter]);

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
    setDepartmentFilter("");
    setPage(0);
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pass = "";
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((f) => ({ ...f, password: pass }));
  };

  function handleOpenAdd() {
    setEditingId(null);
    setFormError("");
    setFields({});
    setProfSearch("");
    setForm({
      fullName: "",
      title: dynamicTitles.length > 0 ? dynamicTitles[0].name : "Prof. Dr.",
      professionCodes: [],
      targetInstitution: 1,
      hospitalId: "",
      nationalIdentifier: "",
      email: "",
      phoneNumber: "",
      password: "",
      consultationFee: 1000,
      revenueSharePercent: 70,
      isActive: true,
      smsEnabled: true,
      emailEnabled: true,
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(id: string) {
    const token = getToken();
    if (!token) return;
    setError("");
    setSuccessMsg("");
    setProfSearch("");

    api<{
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
      revenueSharePercent: number;
      isActive: boolean;
      smsEnabled: boolean;
      emailEnabled: boolean;
    }>(API.admin.doctorDetail(id), {}, token)
      .then((d) => {
        setEditingId(id);
        setFormError("");
        setFields({});
        setForm({
          fullName: d.fullName,
          title: d.title,
          professionCodes: d.professionCodes ?? [],
          targetInstitution: d.targetInstitution || 1,
          hospitalId: d.hospitalId || "",
          nationalIdentifier: d.nationalIdentifier || "",
          email: d.email || "",
          phoneNumber: d.phoneNumber || "",
          password: "",
          consultationFee: d.consultationFee || 1000,
          revenueSharePercent: d.revenueSharePercent ?? 70,
          isActive: d.isActive,
          smsEnabled: d.smsEnabled !== false,
          emailEnabled: d.emailEnabled !== false,
        });
        setIsModalOpen(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Hekim detayları yüklenemedi."));
  }

  function handleProfessionToggle(code: string) {
    setForm((f) => {
      const idx = f.professionCodes.indexOf(code);
      const next = [...f.professionCodes];
      if (idx > -1) {
        next.splice(idx, 1);
      } else {
        next.push(code);
      }
      return { ...f, professionCodes: next };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const f: FieldErrors = {};

    const nameErr = validatePersonName(form.fullName, "Doktor adı");
    if (nameErr) f.fullName = nameErr;

    if (!form.nationalIdentifier.trim()) {
      f.nationalIdentifier = "T.C. Kimlik numarası zorunludur.";
    } else if (form.nationalIdentifier.length !== 11) {
      f.nationalIdentifier = "T.C. Kimlik numarası 11 hane olmalıdır.";
    }

    if (!form.email.trim()) f.email = "E-posta adresi zorunludur.";
    if (!form.phoneNumber.trim()) f.phoneNumber = "Telefon numarası zorunludur.";

    if (!editingId && !form.password.trim()) {
      f.password = "Hekim hesabı için giriş şifresi zorunludur.";
    }

    if (form.consultationFee <= 0) {
      f.consultationFee = "Geçerli bir muayene ücreti girin.";
    }

    if (form.revenueSharePercent < 0 || form.revenueSharePercent > 100) {
      f.revenueSharePercent = "Doktor payı 0–100 arasında olmalıdır.";
    }

    if (form.professionCodes.length === 0) {
      f.professionCodes = "En az bir klinik bölüm (branş) seçilmelidir.";
    }

    setFields(f);
    if (hasErrors(f)) return;

    const token = getToken();
    if (!token) return;

    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        title: form.title,
        professionCodes: form.professionCodes,
        targetInstitution: form.targetInstitution,
        hospitalId: form.hospitalId || "",
        nationalIdentifier: form.nationalIdentifier.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        consultationFee: form.consultationFee,
        revenueSharePercent: form.revenueSharePercent,
        isActive: form.isActive,
        smsEnabled: form.smsEnabled,
        emailEnabled: form.emailEnabled,
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
      };
      if (editingId) {
        await api(
          API.admin.doctorUpdate(editingId),
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
          token
        );
        setSuccessMsg("Doktor başarıyla güncellendi.");
      } else {
        await api(
          API.admin.doctors,
          {
            method: "POST",
            body: JSON.stringify({ ...payload, password: form.password.trim() }),
          },
          token
        );
        setSuccessMsg("Doktor başarıyla eklendi.");
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length > 0) setFields(err.fields);
        setFormError(err.message);
      } else {
        setFormError("Hekim kaydedilemedi.");
      }
    } finally {
      setSaving(false);
    }
  }

  const titleOptions = (() => {
    const base =
      dynamicTitles.length > 0
        ? dynamicTitles
            .filter((t) => t.isActive || t.name === form.title)
            .map((t) => ({ value: t.name, label: t.name }))
        : DEFAULT_TITLES;
    if (form.title && !base.some((o) => o.value === form.title)) {
      return [{ value: form.title, label: form.title }, ...base];
    }
    return base;
  })();

  return (
    <AdminAppShell title="Doktor Yönetimi" description="Hekim kadrosunu, uzmanlık alanlarını ve iletişim ayarlarını yönetin">
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {successMsg ? <FormAlert title="Başarılı" message={successMsg} variant="default" /> : null}

      <div className="mb-4 flex min-w-0 flex-col justify-between gap-3 print:hidden md:mb-6 md:flex-row md:items-end">
        <form onSubmit={handleSearchSubmit} className="admin-filter-bar min-w-0 flex-grow space-y-3 rounded-xl border bg-white p-3 sm:rounded-2xl sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="search" className="text-xs font-semibold">Arama</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  className="h-10 rounded-xl pl-9"
                  placeholder="Hekim adı veya unvan"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>
            <FormSelect
              id="dept-filter"
              label="Klinik bölüm"
              value={departmentFilter || undefined}
              onChange={(e) => { setPage(0); setDepartmentFilter(e.target.value); }}
              placeholder="Tüm bölümler"
              options={professions.map((p) => ({ value: p.code, label: p.name }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" className="h-9 gap-1.5 rounded-xl px-4 font-semibold">
              <Search className="h-4 w-4" />
              Ara
            </Button>
            {(searchText || searchQuery || departmentFilter) ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters} className="h-9 rounded-xl">
                Temizle
              </Button>
            ) : null}
          </div>
        </form>

        <Button onClick={handleOpenAdd} className="h-10 gap-1.5 self-end rounded-xl px-5 font-bold">
          <Plus className="h-4 w-4" />
          Hekim Ekle
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : doctors.length === 0 ? (
        <p className="p-12 text-center text-sm text-muted-foreground italic bg-white rounded-2xl border border-dashed shadow-sm">
          Kriterlerinize uygun hekim kaydı bulunamadı.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className=" overflow-hidden rounded-xl /80 bg-white/95 sm:rounded-2xl">
            <CardContent className="admin-table-scroll p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Hekim Ad Soyad</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ana Branş</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Bağlı Hastane</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Pay %</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Durum</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.map((d) => (
                    <TableRow key={d.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="px-6 py-4 font-semibold text-foreground">
                        <span className="text-muted-foreground font-medium mr-1.5">{d.title}</span>
                        {d.fullName}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground font-medium">{d.professionCode}</TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground text-xs">{d.hospitalName || "Serbest (Kurum Dışı)"}</TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground font-medium">
                        %{d.revenueSharePercent ?? 70}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge variant={d.isActive ? "default" : "secondary"}>
                          {d.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(d.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-primary rounded-full"
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

          {/* Premium Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/40 border /50 rounded-2xl px-6 py-4 mt-2 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground tracking-wide font-sans">
              Toplam <span className="text-primary font-bold">{totalCount}</span> hekimden <span className="text-foreground font-bold">{page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)}</span> arası listeleniyor
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all duration-150"
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
                            : " text-muted-foreground hover:bg-muted hover:text-foreground"
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
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all duration-150"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-xl shadow-2xl bg-white my-8">
            <form onSubmit={submit} noValidate>
              <CardHeader className="relative border-b pb-4">
                <CardTitle className="text-base text-foreground font-bold">
                  {editingId ? "Hekim Bilgilerini Düzenle" : "Yeni Doktor Ekle"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Hekimin klinik bilgilerini, muayene ücretini ve giriş şifresini yönetin.
                </CardDescription>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-4 p-1 rounded-full hover:bg-muted"
                  onClick={() => setIsModalOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>

              <CardContent className="pt-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2">
                {formError ? <FormAlert title="Hata" message={formError} /> : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    id="fullName"
                    label="Ad Soyad"
                    placeholder="Örn: Ali Çelik"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    error={fields.fullName}
                  />

                  <FormSelect
                    id="title"
                    label="Unvan"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    options={titleOptions}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    id="nationalIdentifier"
                    label="TC Kimlik No"
                    inputMode="numeric"
                    maxLength={11}
                    value={form.nationalIdentifier}
                    onChange={(e) => setForm((f) => ({ ...f, nationalIdentifier: e.target.value }))}
                    error={fields.nationalIdentifier}
                    disabled={!!editingId}
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
                </div>

                <TextInput
                  id="revenueSharePercent"
                  label="Doktor Kazanç Payı (%)"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={String(form.revenueSharePercent)}
                  onChange={(e) => setForm((f) => ({ ...f, revenueSharePercent: Number(e.target.value) }))}
                  error={fields.revenueSharePercent}
              hint="Ödeme net tutarından doktora aktarılacak yüzde. Kalan kurum payıdır."
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    id="email"
                    label="E-posta Adresi"
                    type="email"
                    placeholder="hekim@hastane.com"
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
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <PasswordInput
                      id="password"
                      label={editingId ? "Şifre Değiştir (İsteğe Bağlı)" : "Giriş Şifresi"}
                      placeholder={editingId ? "Aynı kalması için boş bırakın" : "Şifre girin veya sağdaki butona basın"}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      error={fields.password}
                      defaultVisible
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={generateRandomPassword} className="h-9 mb-0.5 font-bold gap-1 rounded-xl">
                    <Lock className="h-3.5 w-3.5" />
                    Şifre Üret
                  </Button>
                </div>

                <FormSelect
                  id="hospitalId"
                  label="Bağlı Olduğu Hastane"
                  placeholder="Hastane seçiniz (İsteğe bağlı)"
                  value={form.hospitalId || NO_HOSPITAL}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      hospitalId: e.target.value === NO_HOSPITAL ? "" : e.target.value,
                    }))
                  }
                  options={[
                    { value: NO_HOSPITAL, label: "Serbest / Kurum Dışı" },
                    ...hospitals.map((h) => ({ value: h.id, label: h.name })),
                  ]}
                />

                {/* Multiselect search klinik bölüm listesi */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Hizmet Verdiği Klinik Bölümler (Branşlar)
                  </label>
                  {fields.professionCodes && (
                    <p className="text-xs font-medium text-destructive">{fields.professionCodes}</p>
                  )}

                  {/* Selected Tags list */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.professionCodes.map((code) => {
                      const p = professions.find((prof) => prof.code === code);
                      return (
                        <span key={code} className="inline-flex items-center gap-1 bg-primary/15 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                          {p ? p.name : code}
                          <button
                            type="button"
                            onClick={() => handleProfessionToggle(code)}
                            className="text-primary/75 hover:text-primary rounded-full p-0.5 hover:bg-primary/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  {/* Search inside multiselect */}
                  <TextInput
                    id="profSearch"
                    label=""
                    placeholder="Bölüm adı yazarak filtreleyin..."
                    value={profSearch}
                    onChange={(e) => setProfSearch(e.target.value)}
                    className="h-8 text-xs"
                  />

                  <div className="max-h-[140px] overflow-y-auto border rounded-xl p-3 bg-muted/40 mt-1 grid gap-2">
                    {professions.filter(
                      (p) =>
                        p.name.toLowerCase().includes(profSearch.toLowerCase()) ||
                        p.code.toLowerCase().includes(profSearch.toLowerCase())
                    ).length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">Bölüm bulunamadı.</span>
                    ) : (
                      professions
                        .filter(
                          (p) =>
                            p.name.toLowerCase().includes(profSearch.toLowerCase()) ||
                            p.code.toLowerCase().includes(profSearch.toLowerCase())
                        )
                        .map((p) => {
                          const checked = form.professionCodes.includes(p.code);
                          return (
                            <div key={p.id} className="flex items-center space-x-2.5 hover:bg-muted/50 p-1 rounded-lg transition-colors cursor-pointer">
                              <input
                                type="checkbox"
                                id={`prof-${p.code}`}
                                checked={checked}
                                onChange={() => handleProfessionToggle(p.code)}
                                className="rounded text-primary focus:ring-primary cursor-pointer h-4 w-4"
                              />
                              <label
                                htmlFor={`prof-${p.code}`}
                                className="text-xs font-semibold text-foreground cursor-pointer select-none leading-none w-full"
                              >
                                {p.name}
                              </label>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Welcoming preferences checkboxes */}
                {!editingId && (
                  <div className="grid gap-2 border-t pt-3 mt-1">
                    <span className="text-xs font-bold text-muted-foreground">Doktora Karşılama Bildirimi</span>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="checkbox"
                          id="smsEnabled"
                          checked={form.smsEnabled}
                          onChange={(e) => setForm((f) => ({ ...f, smsEnabled: e.target.checked }))}
                          className="rounded text-primary focus:ring-primary cursor-pointer h-4 w-4"
                        />
                        <label htmlFor="smsEnabled" className="text-xs font-semibold text-foreground cursor-pointer">
                          SMS Gönder (Şifre ile)
                        </label>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="checkbox"
                          id="emailEnabled"
                          checked={form.emailEnabled}
                          onChange={(e) => setForm((f) => ({ ...f, emailEnabled: e.target.checked }))}
                          className="rounded text-primary focus:ring-primary cursor-pointer h-4 w-4"
                        />
                        <label htmlFor="emailEnabled" className="text-xs font-semibold text-foreground cursor-pointer">
                          E-posta Gönder (Şifre ile)
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {editingId && (
                  <div className="flex items-center space-x-2.5 py-2 border-t mt-2">
                    <input
                      type="checkbox"
                      id="doc-isActive"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="rounded text-primary focus:ring-primary cursor-pointer h-4 w-4"
                    />
                    <label
                      htmlFor="doc-isActive"
                      className="text-xs font-semibold text-foreground cursor-pointer select-none"
                    >
                      Hekim Aktif / Görünür
                    </label>
                  </div>
                )}
              </CardContent>

              <CardContent className="border-t pt-4 flex gap-2 justify-end bg-muted/40">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={saving} className="font-bold rounded-xl">
                  İptal
                </Button>
                <Button type="submit" size="sm" disabled={saving} className="font-bold rounded-xl">
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
