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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="shadow-premium border-slate-200 bg-white/95 rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Toplam Ciro</span>
              <span className="text-xl font-black text-slate-900">
                {totalEarnings.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
              </span>
              <span className="text-[10px] text-slate-500 font-semibold block">{paidCount} başarılı ödemeden</span>
            </div>
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-premium border-slate-200 bg-white/95 rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Başarılı Ödemeler</span>
              <span className="text-xl font-black text-slate-900">{paidCount} Adet</span>
              <span className="text-[10px] text-slate-500 font-semibold block">Hizmet bedeli tahsil edilen</span>
            </div>
            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-premium border-slate-200 bg-white/95 rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Bekleyen Ödemeler</span>
              <span className="text-xl font-black text-slate-900">{pendingCount} Adet</span>
              <span className="text-[10px] text-slate-500 font-semibold block">Ödeme onayı veya havale bekleyen</span>
            </div>
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-premium border-slate-200 bg-white/95 rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">İade İşlemleri</span>
              <span className="text-xl font-black text-slate-900">{refundCount} Adet</span>
              <span className="text-[10px] text-slate-500 font-semibold block">İadesi tamamlanmış başvurular</span>
            </div>
            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl">
              <RefreshCw className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Filter Area */}
      <Card className="shadow-premium border-slate-200/80 bg-white/95 rounded-2xl overflow-hidden mb-6 print:hidden">
        <CardContent className="p-5 grid gap-4 md:grid-cols-3 items-end">
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="search" className="text-xs font-bold text-slate-700 tracking-wide">Arama</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="search"
                className="pl-10 h-10 border-slate-200 focus-visible:ring-primary/20 focus-visible:border-primary bg-white rounded-xl shadow-inner-sm"
                placeholder="Hasta adı, Başvuru No veya E-Ticaret No yazın..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div>
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

      {/* Applications List Table */}
      <Card className="shadow-premium border-slate-200/80 bg-white/95 rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-5 px-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-800 font-bold flex items-center gap-2">
                Hasta Başvuruları
                <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                  {filteredApps.length}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Sistemdeki son görüş talepleri ve operasyonel işlem geçmişi
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="p-16 text-center">
              <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium font-sans">Filtrelere uygun başvuru kaydı bulunamadı.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-6">Hasta Adı</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-6">Başvuru Numarası</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-6">Referans No / ID</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-6">Oluşturulma</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-6">Durum</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-6 text-right print:hidden"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.map((a) => (
                    <TableRow
                      key={a.applicationId}
                      onClick={() => router.push(ROUTES.admin.application(a.applicationId))}
                      className="hover:bg-slate-50/60 transition-all duration-150 group cursor-pointer border-b last:border-0"
                    >
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold shadow-sm", getAvatarColor(a.patientName))}>
                            {getInitials(a.patientName)}
                          </div>
                          <Link
                            href={ROUTES.admin.application(a.applicationId)}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-slate-900 group-hover:text-primary transition-colors underline-offset-4 hover:underline font-sans"
                          >
                            {a.patientName}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <span className="font-mono text-xs bg-slate-100/80 border border-slate-200/60 text-slate-700 px-2 py-0.5 rounded inline-flex items-center gap-1 font-semibold">
                          <Hash className="h-3 w-3 text-slate-400" />
                          {applicationDisplayNumber(a)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {a.ecommerceNumber ? (
                          <span className="font-mono text-xs bg-primary/5 border border-primary/10 text-primary px-2 py-0.5 rounded inline-flex items-center gap-1 font-semibold">
                            <ShoppingBag className="h-3 w-3 text-primary/70" />
                            {a.ecommerceNumber}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-400 bg-slate-50 border border-slate-200/40 px-2 py-0.5 rounded">
                            {a.applicationId.slice(0, 8)}…
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-slate-500 text-xs font-medium font-sans">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {a.createdAt ? new Date(a.createdAt).toLocaleString("tr-TR") : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant={statusVariant(a.statusCode)}>
                          {STATUS_LABELS[a.statusCode] ?? a.statusCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right print:hidden">
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform font-sans">
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
          )}
        </CardContent>
      </Card>
    </AdminAppShell>
  );
}
