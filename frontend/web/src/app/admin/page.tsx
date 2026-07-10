"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, FormSelect } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS, statusVariant, applicationDisplayNumber } from "@/lib/application";
import { Button } from "@/components/ui/button";
import { ClipboardList, Hash, ShoppingBag, Calendar, ChevronRight, DollarSign, CreditCard, Clock, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-blue-50 text-blue-600 border-blue-100",
    "bg-indigo-50 text-indigo-600 border-indigo-100",
    "bg-purple-50 text-purple-600 border-purple-100",
    "bg-sky-50 text-sky-600 border-sky-100",
    "bg-violet-50 text-violet-600 border-violet-100",
    "bg-teal-50 text-teal-600 border-teal-100",
  ];
  if (!name) return colors[0];
  const charCode = name.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
};

type AppRow = {
  applicationId: string;
  statusCode: number;
  patientName: string;
  applicationNumber?: string;
  ecommerceNumber?: string;
  createdAt?: string;
};

type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  function load(token: string) {
    return Promise.all([
      api<AppRow[]>(API.admin.applications, {}, token),
      api<{ items: PaymentRow[] }>(`${API.admin.payments}?pageSize=1000`, {}, token).catch(() => ({ items: [] })),
    ]).then(([a, p]) => {
      setApps(a ?? []);
      setPayments(p?.items ?? []);
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

  // Client-side filtering of applications
  const filteredApps = apps.filter((a) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      a.patientName.toLowerCase().includes(query) ||
      a.applicationNumber?.toLowerCase().includes(query) ||
      a.ecommerceNumber?.toLowerCase().includes(query) ||
      a.applicationId.toLowerCase().includes(query);

    const matchesStatus = statusFilter === "all" || String(a.statusCode) === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalEarnings = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const pendingCount = payments.filter((p) => p.status === "pending" || p.status === "waiting").length;
  const refundCount = payments.filter((p) => p.status === "refunded").length;

  return (
    <AdminAppShell
      title="Yönetim Paneli"
      description="Sistemdeki başvuruların durumunu inceleyin, finansal özetleri ve klinik istatistikleri görüntüleyin"
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {/* Reports & Analytics Summary Dashboard */}
      <div className="mb-2 grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4 sm:mb-4">
        <Card className="shadow-premium overflow-hidden rounded-xl border-slate-200 bg-white/95 sm:rounded-2xl hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-5">
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 sm:text-[11px]">Toplam Ciro</span>
              <span className="block truncate text-base font-black text-slate-900 sm:text-xl">
                {totalEarnings.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
              </span>
              <span className="hidden text-[10px] font-semibold text-slate-500 sm:block">{paidCount} başarılı ödemeden</span>
            </div>
            <div className="hidden shrink-0 rounded-2xl bg-emerald-50 p-3.5 text-emerald-600 sm:block">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-premium overflow-hidden rounded-xl border-slate-200 bg-white/95 sm:rounded-2xl hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-5">
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 sm:text-[11px]">Başarılı</span>
              <span className="block text-base font-black text-slate-900 sm:text-xl">{paidCount} Adet</span>
              <span className="hidden text-[10px] font-semibold text-slate-500 sm:block">Hizmet bedeli tahsil edilen</span>
            </div>
            <div className="hidden shrink-0 rounded-2xl bg-blue-50 p-3.5 text-blue-600 sm:block">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-premium overflow-hidden rounded-xl border-slate-200 bg-white/95 sm:rounded-2xl hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-5">
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 sm:text-[11px]">Bekleyen</span>
              <span className="block text-base font-black text-slate-900 sm:text-xl">{pendingCount} Adet</span>
              <span className="hidden text-[10px] font-semibold text-slate-500 sm:block">Ödeme onayı bekleyen</span>
            </div>
            <div className="hidden shrink-0 rounded-2xl bg-amber-50 p-3.5 text-amber-600 sm:block">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-premium overflow-hidden rounded-xl border-slate-200 bg-white/95 sm:rounded-2xl hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-5">
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 sm:text-[11px]">İade</span>
              <span className="block text-base font-black text-slate-900 sm:text-xl">{refundCount} Adet</span>
              <span className="hidden text-[10px] font-semibold text-slate-500 sm:block">İadesi tamamlanmış</span>
            </div>
            <div className="hidden shrink-0 rounded-2xl bg-rose-50 p-3.5 text-rose-600 sm:block">
              <RefreshCw className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Filter Area */}
      <Card className="shadow-premium mb-2 overflow-hidden rounded-xl border-slate-200/80 bg-white/95 sm:mb-4 sm:rounded-2xl print:hidden">
        <CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3 sm:gap-4 sm:p-5 items-end">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="search" className="text-xs font-bold tracking-wide text-slate-700">Arama</label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="search"
                className="h-10 rounded-xl border-slate-200 bg-white pl-10 shadow-inner-sm focus-visible:border-primary focus-visible:ring-primary/20"
                placeholder="Hasta adı, başvuru no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="min-w-0">
            <FormSelect
              id="status-filter"
              label="Durum Filtresi"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "Tüm Durumlar" },
                ...Object.entries(STATUS_LABELS).map(([code, label]) => ({
                  value: code,
                  label: label,
                })),
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      <Card className="shadow-premium overflow-hidden rounded-xl border-slate-200/80 bg-white/95 sm:rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-slate-50/50 px-3 py-3 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="hidden rounded-xl bg-primary/10 p-2 sm:block">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800 sm:text-base">
                Hasta Başvuruları
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {filteredApps.length}
                </span>
              </CardTitle>
              <CardDescription className="hidden text-xs sm:block">
                Sistemdeki son görüş talepleri ve operasyonel işlem geçmişi
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4 sm:p-8">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="p-10 text-center sm:p-16">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              {apps.length === 0 ? (
                <div className="mx-auto max-w-md space-y-3">
                  <p className="font-sans text-sm font-semibold text-slate-700">
                    Henüz hasta başvurusu yok
                  </p>
                  <p className="font-sans text-sm text-slate-500">
                    Bu normal. Panel çalışıyor; başvurular hastalar oluşturdukça burada listelenir.
                    Sol menüden doktor, hastane, bölüm ve ödeme yönetimine geçebilirsiniz.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={ROUTES.admin.doctors}>Doktorlar</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={ROUTES.admin.hospitals}>Hastaneler</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={ROUTES.admin.payments}>Ödemeler</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="font-sans text-sm font-medium text-slate-500">
                  Filtrelere uygun başvuru kaydı bulunamadı.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredApps.map((a) => (
                  <button
                    key={a.applicationId}
                    type="button"
                    onClick={() => router.push(ROUTES.admin.application(a.applicationId))}
                    className="flex w-full flex-col gap-2 px-3 py-3 text-left active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold", getAvatarColor(a.patientName))}>
                          {getInitials(a.patientName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{a.patientName}</p>
                          <p className="truncate font-mono text-[11px] text-slate-500">
                            {applicationDisplayNumber(a)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-[2.625rem]">
                      <Badge variant={statusVariant(a.statusCode)} className="text-[10px]">
                        {STATUS_LABELS[a.statusCode] ?? a.statusCode}
                      </Badge>
                      <span className="text-[11px] text-slate-400">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString("tr-TR") : "—"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop table */}
              <div className="admin-table-scroll hidden md:block">
                <Table>
                  <TableHeader className="bg-slate-50/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-10 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:px-6">Hasta Adı</TableHead>
                      <TableHead className="h-10 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:px-6">Başvuru Numarası</TableHead>
                      <TableHead className="h-10 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:px-6">Referans No / ID</TableHead>
                      <TableHead className="h-10 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:px-6">Oluşturulma</TableHead>
                      <TableHead className="h-10 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:px-6">Durum</TableHead>
                      <TableHead className="h-10 px-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 print:hidden lg:px-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApps.map((a) => (
                      <TableRow
                        key={a.applicationId}
                        onClick={() => router.push(ROUTES.admin.application(a.applicationId))}
                        className="group cursor-pointer border-b transition-all duration-150 last:border-0 hover:bg-slate-50/60"
                      >
                        <TableCell className="px-4 py-4 lg:px-6">
                          <div className="flex items-center gap-3">
                            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold shadow-sm", getAvatarColor(a.patientName))}>
                              {getInitials(a.patientName)}
                            </div>
                            <Link
                              href={ROUTES.admin.application(a.applicationId)}
                              onClick={(e) => e.stopPropagation()}
                              className="font-sans font-semibold text-slate-900 underline-offset-4 transition-colors hover:underline group-hover:text-primary"
                            >
                              {a.patientName}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 lg:px-6">
                          <span className="inline-flex items-center gap-1 rounded border border-slate-200/60 bg-slate-100/80 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                            <Hash className="h-3 w-3 text-slate-400" />
                            {applicationDisplayNumber(a)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 lg:px-6">
                          {a.ecommerceNumber ? (
                            <span className="inline-flex items-center gap-1 rounded border border-primary/10 bg-primary/5 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                              <ShoppingBag className="h-3 w-3 text-primary/70" />
                              {a.ecommerceNumber}
                            </span>
                          ) : (
                            <span className="rounded border border-slate-200/40 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-400">
                              {a.applicationId.slice(0, 8)}…
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 font-sans text-xs font-medium text-slate-500 lg:px-6">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {a.createdAt ? new Date(a.createdAt).toLocaleString("tr-TR") : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 lg:px-6">
                          <Badge variant={statusVariant(a.statusCode)}>
                            {STATUS_LABELS[a.statusCode] ?? a.statusCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right print:hidden lg:px-6">
                          <div className="flex justify-end opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                            <span className="inline-flex items-center gap-0.5 font-sans text-xs font-bold text-primary transition-transform group-hover:translate-x-0.5">
                              Detay
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </AdminAppShell>
  );
}
