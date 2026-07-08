"use client";

import { ROUTES } from "@/lib/routes";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { hasErrors, validateRefundAmount, validateRefundReason, type FieldErrors } from "@/lib/validation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, TextInput } from "@/components/FormField";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Check, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Payment = {
  id: string;
  applicationId: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  patientName?: string;
  createdAt?: string;
};

export default function AdminRefundsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});

  const [form, setForm] = useState({
    paymentId: "",
    amount: "",
    reason: "",
  });

  // Table filters & pagination for payments
  const [page, setPage] = useState(0);
  const [pageSize] = useState(5);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadPayments = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);

    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search: searchQuery.trim(),
      startDate,
      endDate,
    }).toString();

    api<{ items: Payment[]; totalCount: number }>(`${API.admin.payments}?${query}`, {}, token)
      .then((res) => {
        setPayments(res?.items ?? []);
        setTotalCount(res?.totalCount ?? 0);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Ödemeler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [page, pageSize, searchQuery, startDate, endDate]);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace(ROUTES.admin.login);
      return;
    }
    loadPayments();
  }, [router, loadPayments]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchText);
  };

  const handleClearFilters = () => {
    setSearchText("");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const f: FieldErrors = {};
    if (!form.paymentId.trim()) f.paymentId = "Ödeme kimliği zorunludur.";
    const amount = Number(form.amount);
    const amountErr = validateRefundAmount(amount);
    if (amountErr) f.amount = amountErr;
    const reasonErr = validateRefundReason(form.reason);
    if (reasonErr) f.reason = reasonErr;
    setFields(f);
    if (hasErrors(f)) return;

    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await api<{ applicationId: string; status: string }>(
        API.admin.refunds,
        {
          method: "POST",
          body: JSON.stringify({
            paymentId: form.paymentId,
            amount,
            reason: form.reason,
          }),
        },
        token
      );
      setMsg(`İade talebi başarıyla oluşturuldu. Başvuru: ${res.applicationId}`);
      setForm({ paymentId: "", amount: "", reason: "" });
      loadPayments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İade oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  function pickPayment(p: Payment) {
    setForm((f) => ({
      ...f,
      paymentId: p.id,
      amount: String(p.amount),
    }));
  }

  return (
    <AdminAppShell title="İadeler" description="Hasta ödemeleri için iade talepleri oluşturun ve yönetin">
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Başarılı" message={msg} variant="default" /> : null}

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Card: Refund Request Form */}
        <Card className="lg:col-span-5 shadow-premium border-slate-200/80 bg-white/95 rounded-2xl overflow-hidden">
          <form onSubmit={submit} noValidate>
            <CardHeader className="bg-slate-50/50 border-b py-5 px-6">
              <CardTitle className="text-base text-slate-800 font-bold flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                İade Talebi Oluştur
              </CardTitle>
              <CardDescription className="text-xs">Ödeme detaylarını ve iade gerekçesini girin.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col gap-4">
              <TextInput
                id="paymentId"
                label="Ödeme Kimliği (UUID)"
                placeholder="Ödemeler tablosundan seçin veya buraya yapıştırın"
                value={form.paymentId}
                onChange={(e) => setForm((f) => ({ ...f, paymentId: e.target.value }))}
                error={fields.paymentId}
              />
              <TextInput
                id="amount"
                label="İade Tutarı (₺)"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                error={fields.amount}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="reason" className="text-xs font-semibold text-slate-700">İade Gerekçesi</label>
                <textarea
                  id="reason"
                  rows={3}
                  placeholder="İade yapılma nedenini açıklayın..."
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {fields.reason && (
                  <p className="text-xs text-destructive mt-1">{fields.reason}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-end bg-slate-50/50">
              <Button type="submit" disabled={saving} className="font-bold">
                {saving ? "Gönderiliyor..." : "İade Talebini Başlat"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Right Card: Paged Payments Table */}
        <Card className="lg:col-span-7 shadow-premium border-slate-200/80 bg-white/95 rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b py-5 px-6">
            <CardTitle className="text-base text-slate-800 font-bold">Ödemeler Listesi</CardTitle>
            <CardDescription className="text-xs">İade işlemi yapmak istediğiniz ödemeyi seçin</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-4">
            {/* Premium Filter controls */}
            <form onSubmit={handleSearchSubmit} className="grid gap-3 sm:grid-cols-2 items-end p-4 bg-white border border-slate-200/60 rounded-2xl shadow-sm">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label htmlFor="search" className="text-xs font-bold text-slate-700">Arama</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="search"
                    className="pl-9 h-9 text-xs border-slate-200 rounded-xl"
                    placeholder="Hasta adı veya başvuru no..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>
              </div>
              <CustomDatePicker
                id="startDate"
                label="Başlangıç"
                value={startDate}
                onChange={(val) => { setPage(0); setStartDate(val); }}
                className="col-span-1"
              />
              <CustomDatePicker
                id="endDate"
                label="Bitiş"
                value={endDate}
                onChange={(val) => { setPage(0); setEndDate(val); }}
                className="col-span-1"
              />
              <div className="sm:col-span-2 flex justify-end gap-2 mt-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs font-bold rounded-lg" onClick={handleClearFilters}>
                  Temizle
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs font-bold gap-1 rounded-lg">
                  <Search className="h-3 w-3" />
                  Ara
                </Button>
              </div>
            </form>

            {/* Payments Table */}
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full rounded-xl" />
                <Skeleton className="h-8 w-full rounded-xl" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 font-medium italic border border-dashed rounded-xl p-4">Ödeme kaydı bulunamadı.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/60 rounded-xl">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2 px-4">Hasta / Payer</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2 px-4">Tutar</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2 px-4">Tarih</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2 px-4 text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => {
                      const isPicked = form.paymentId === p.id;
                      return (
                        <TableRow key={p.id} className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${isPicked ? "bg-primary/5 hover:bg-primary/5" : ""}`} onClick={() => pickPayment(p)}>
                          <TableCell className="py-2.5 px-4 font-semibold text-slate-800 text-xs">
                            <span className="block">{p.patientName || "—"}</span>
                            <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{p.id.slice(0, 8)}…</span>
                          </TableCell>
                          <TableCell className="py-2.5 px-4 text-slate-900 font-bold text-xs">
                            {p.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {p.currency}
                          </TableCell>
                          <TableCell className="py-2.5 px-4 text-[10px] text-slate-500 font-mono">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString("tr-TR") : "—"}
                          </TableCell>
                          <TableCell className="py-2.5 px-4 text-right">
                            <Button
                              type="button"
                              variant={isPicked ? "default" : "outline"}
                              size="sm"
                              className="h-7 px-2.5 text-[10px] font-bold gap-1 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                pickPayment(p);
                              }}
                            >
                              {isPicked ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  Seçildi
                                </>
                              ) : (
                                "Seç"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Premium Pagination for Refunds page */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 border border-slate-200/50 rounded-2xl px-4 py-3 mt-2 shadow-sm">
              <div className="text-[10px] font-semibold text-slate-500 tracking-wide font-sans">
                Toplam <span className="text-primary font-bold">{totalCount}</span> kayıttan <span className="text-slate-800 font-bold">{page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)}</span> arası
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-7 w-7 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all duration-150"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
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
                            "h-7 min-w-[28px] px-1.5 text-[10px] font-bold rounded-lg transition-all duration-150",
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
                  className="h-7 w-7 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all duration-150"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminAppShell>
  );
}
