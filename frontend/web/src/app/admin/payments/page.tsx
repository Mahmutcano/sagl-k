"use client";

import { ROUTES } from "@/lib/routes";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole, fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert } from "@/components/FormField";
import { CustomDatePicker } from "@/components/CustomDatePicker";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText, Printer, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
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

type Invoice = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  providerTransactionId?: string;
  paidAt?: string;
  createdAt: string;
  applicationId: string;
  patientName: string;
  patientNationalId?: string;
  patientEmail: string;
  patientPhone: string;
  hospitalName?: string;
  professionName?: string;
  doctorName?: string;
  ecommerceNumber?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceProvider?: string;
  invoiceStatus?: string;
  invoiceError?: string;
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filter & Pagination State
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const fetchPayments = useCallback(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace(ROUTES.admin.login);
      return;
    }
    setLoading(true);
    setError("");

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
  }, [router, page, pageSize, searchQuery, startDate, endDate]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

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

  async function handleExport() {
    const token = getToken();
    if (!token) return;
    setExporting(true);
    setError("");
    try {
      const res = await fetchTextWithAuth("/api/v1/admin/payments/export", {}, token);
      if (!res.ok) throw new Error("CSV indirilemedi.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `odemeler_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("CSV dışa aktarılamadı.");
    } finally {
      setExporting(false);
    }
  }

  async function handleViewInvoice(paymentId: string) {
    const token = getToken();
    if (!token) return;
    setLoadingInvoice(true);
    setError("");
    try {
      const details = await api<Invoice>(API.admin.paymentInvoice(paymentId), {}, token);
      setSelectedInvoice(details);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fatura detayları yüklenemedi.");
    } finally {
      setLoadingInvoice(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <AdminAppShell title="Ödemeler & Faturalar" description="Sistemdeki finansal hareketler ve e-makbuzlar">
      {/* Print-only CSS layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-receipt-container, #print-receipt-container * {
            visibility: visible !important;
          }
          #print-receipt-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}} />

      {error ? <FormAlert title="Hata" message={error} /> : null}

      <div className="mb-4 flex min-w-0 flex-col gap-3 print:hidden lg:mb-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Premium Filter Area */}
        <form onSubmit={handleSearchSubmit} className="admin-filter-bar min-w-0 flex-1 rounded-xl border border-slate-200/80 bg-white p-3 shadow-premium sm:rounded-2xl sm:p-5">
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-2">
            <label htmlFor="search" className="text-xs font-bold tracking-wide text-slate-700">Arama</label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="search"
                className="h-10 rounded-xl border-slate-200 bg-white pl-10 shadow-inner-sm focus-visible:border-primary focus-visible:ring-primary/20"
                placeholder="Hasta adı, başvuru no..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>
          <CustomDatePicker
            id="startDate"
            label="Başlangıç Tarihi"
            value={startDate}
            onChange={(val) => { setPage(0); setStartDate(val); }}
          />
          <CustomDatePicker
            id="endDate"
            label="Bitiş Tarihi"
            value={endDate}
            onChange={(val) => { setPage(0); setEndDate(val); }}
          />
          <div className="col-span-full flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end sm:gap-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters} className="h-9 rounded-xl px-4 font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              Filtreleri Temizle
            </Button>
            <Button type="submit" size="sm" className="h-9 gap-1.5 rounded-xl px-5 font-bold shadow-md shadow-primary/10">
              <Search className="h-4 w-4" />
              Filtrele
            </Button>
          </div>
        </form>

        <Button onClick={handleExport} disabled={exporting} variant="outline" className="h-10 w-full gap-2 self-stretch rounded-xl border-slate-200 font-bold shadow-sm hover:bg-slate-50 print:hidden lg:w-auto lg:self-end">
          <Download className="h-4 w-4" />
          {exporting ? "Dışa Aktarılıyor..." : "CSV İndir"}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : payments.length === 0 ? (
        <Card className="rounded-2xl shadow-premium border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CardHeader className="p-0">
              <CardTitle className="text-lg font-bold text-slate-800">Ödeme kaydı bulunamadı</CardTitle>
              <CardDescription>Belirttiğiniz kriterlere uygun veya sistemde kayıtlı ödeme bulunmuyor.</CardDescription>
            </CardHeader>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="print:hidden shadow-premium overflow-hidden rounded-xl border-slate-200/80 bg-white/95 sm:rounded-2xl">
            <CardContent className="admin-table-scroll p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hasta Adı</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Başvuru</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sağlayıcı</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tutar</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Durum</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tarih</TableHead>
                    <TableHead className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-6 py-4 font-semibold text-slate-800">
                        {p.patientName || "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Link
                          href={ROUTES.admin.application(p.applicationId)}
                          className="underline-offset-4 hover:underline font-mono text-xs text-primary font-medium"
                        >
                          {p.applicationId.slice(0, 8)}…
                        </Link>
                      </TableCell>
                      <TableCell className="px-6 py-4 capitalize text-slate-600 font-medium">{p.provider}</TableCell>
                      <TableCell className="px-6 py-4 font-bold text-slate-900">
                        {p.amount.toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {p.currency}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                          {p.status === "paid" ? "Ödendi" : p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground text-xs font-mono">
                        {p.createdAt ? new Date(p.createdAt).toLocaleString("tr-TR") : "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewInvoice(p.id)}
                          disabled={loadingInvoice}
                          className="text-xs hover:text-primary gap-1.5 font-bold"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          E-Makbuz
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Premium Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 border border-slate-200/50 rounded-2xl px-6 py-4 mt-2 print:hidden shadow-sm">
            <div className="text-xs font-semibold text-slate-500 tracking-wide font-sans">
              Toplam <span className="text-primary font-bold">{totalCount}</span> kayıttan <span className="text-slate-800 font-bold">{page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)}</span> arası gösteriliyor
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-all duration-150"
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
                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-all duration-150"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Receipt Modal Overlay */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">

            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b bg-slate-50 print:hidden">
              <span className="text-sm font-bold text-slate-600 font-mono">E-Makbuz Detayı</span>
              <div className="flex gap-2">
                <Button onClick={handlePrint} size="sm" className="gap-1.5 font-bold">
                  <Printer className="h-4 w-4" />
                  Yazdır / PDF Kaydet
                </Button>
                <Button onClick={() => setSelectedInvoice(null)} variant="ghost" size="sm" className="p-1 rounded-full hover:bg-slate-200">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Printable Area */}
            <div id="print-receipt-container" className="p-8 flex-1 overflow-y-auto print:overflow-visible print:p-4">

              {/* Receipt Branding */}
              <div className="flex justify-between items-start border-b pb-6 mb-6">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900">TIBBİ DANIŞMANLIK</h2>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">{selectedInvoice.hospitalName || "Erciyes Üniversitesi Tıp Fakültesi Hastaneleri"}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-base font-extrabold text-primary">E-HİZMET MAKBUZU</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">Tarih: {new Date(selectedInvoice.createdAt).toLocaleString("tr-TR")}</p>
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 gap-6 text-sm mb-6 border-b pb-6">
                <div>
                  <span className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Hizmet Alan (Hasta)</span>
                  <p className="font-bold text-slate-800">{selectedInvoice.patientName}</p>
                  {selectedInvoice.patientNationalId && (
                    <p className="text-xs text-slate-600 font-mono mt-0.5">T.C.: {selectedInvoice.patientNationalId}</p>
                  )}
                  <p className="text-xs text-slate-600 mt-0.5">Tel: {selectedInvoice.patientPhone}</p>
                  <p className="text-xs text-slate-600">E-Posta: {selectedInvoice.patientEmail}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Hizmet Veren (Hekim)</span>
                  <p className="font-bold text-slate-800">{selectedInvoice.doctorName || "Atanmamış / Havuz"}</p>
                  {selectedInvoice.professionName && (
                    <p className="text-xs text-slate-600 mt-0.5">Klinik: {selectedInvoice.professionName}</p>
                  )}
                  <p className="text-xs text-slate-600 mt-0.5">Kurum: {selectedInvoice.hospitalName || "Erciyes Hastanesi"}</p>
                </div>
              </div>

              {/* Receipt Details Table */}
              <div className="border rounded-xl overflow-hidden mb-6">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b text-slate-600 font-bold text-xs">
                    <tr>
                      <th className="p-3.5">Hizmet Açıklaması</th>
                      <th className="p-3.5 text-right">Referans No</th>
                      <th className="p-3.5 text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3.5 font-semibold text-slate-800">
                        Tıbbi İkinci Görüş Raporlama ve Klinik Danışmanlık Hizmeti
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs text-muted-foreground">
                        {selectedInvoice.ecommerceNumber || selectedInvoice.applicationId.slice(0, 8)}
                      </td>
                      <td className="p-3.5 text-right font-extrabold text-slate-900">
                        {selectedInvoice.amount.toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {selectedInvoice.currency}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="flex justify-end mb-8">
                <div className="w-64 text-sm space-y-1.5 border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Ara Toplam:</span>
                    <span className="font-semibold">
                      {selectedInvoice.amount.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {selectedInvoice.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">KDV (%0 / Muaf):</span>
                    <span>0,00 {selectedInvoice.currency}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-bold text-base text-slate-900">
                    <span>Toplam Ödeme:</span>
                    <span>
                      {selectedInvoice.amount.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {selectedInvoice.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Footers */}
              <div className="bg-slate-50/50 rounded-xl p-4 text-xs text-slate-600 space-y-1.5 border border-slate-100">
                <p><span className="font-bold text-slate-500">Ödeme Durumu:</span> {selectedInvoice.status.toUpperCase()}</p>
                <p><span className="font-bold text-slate-500">Ödeme Kanalı:</span> Param</p>
                {selectedInvoice.providerTransactionId && (
                  <p className="font-mono"><span className="font-bold font-sans text-slate-500">İşlem (TX) ID:</span> {selectedInvoice.providerTransactionId}</p>
                )}
                {selectedInvoice.paidAt && (
                  <p><span className="font-bold text-slate-500">Ödeme Zamanı:</span> {new Date(selectedInvoice.paidAt).toLocaleString("tr-TR")}</p>
                )}
                {selectedInvoice.invoiceNumber ? (
                  <>
                    <p className="pt-2 border-t border-slate-200"><span className="font-bold text-slate-500">Fatura (Bizim Hesap):</span> {selectedInvoice.invoiceNumber}</p>
                    {selectedInvoice.invoiceId && (
                      <p className="font-mono"><span className="font-bold font-sans text-slate-500">Fatura ID:</span> {selectedInvoice.invoiceId}</p>
                    )}
                    {selectedInvoice.invoiceStatus && (
                      <p><span className="font-bold text-slate-500">Fatura Durumu:</span> {selectedInvoice.invoiceStatus.toUpperCase()}</p>
                    )}
                  </>
                ) : selectedInvoice.invoiceError ? (
                  <p className="pt-2 border-t border-slate-200 text-amber-700"><span className="font-bold">Fatura hatası:</span> {selectedInvoice.invoiceError}</p>
                ) : null}
              </div>

              <div className="text-center mt-12 text-[10px] font-medium text-slate-400 border-t pt-4">
                Bu belge dijital olarak oluşturulmuştur ve ıslak imza gerektirmez. Sorgulama ve doğrulama için başvuru ID kullanılabilir.
              </div>

            </div>

          </div>
        </div>
      )}
    </AdminAppShell>
  );
}
