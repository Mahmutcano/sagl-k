"use client";

import { ROUTES } from "@/lib/routes";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole, fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert } from "@/components/FormField";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText, Printer, X } from "lucide-react";

type Payment = {
  id: string;
  applicationId: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
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
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace(ROUTES.admin.login);
      return;
    }
    api<Payment[]>(API.admin.payments, {}, token)
      .then((rows) => setPayments(rows ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Ödemeler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

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
    } catch (err) {
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
      {error ? <FormAlert title="Hata" message={error} /> : null}

      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button onClick={handleExport} disabled={exporting} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          {exporting ? "Dışa Aktarılıyor..." : "CSV Olarak İndir"}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <CardHeader className="p-0">
              <CardTitle>Ödeme kaydı yok</CardTitle>
              <CardDescription>Hasta ödemeleri burada listelenir.</CardDescription>
            </CardHeader>
          </CardContent>
        </Card>
      ) : (
        <Card className="print:hidden shadow-md border-slate-200">
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başvuru</TableHead>
                  <TableHead>Sağlayıcı</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={ROUTES.admin.application(p.applicationId)}
                        className="underline-offset-4 hover:underline font-mono text-xs"
                      >
                        {p.applicationId.slice(0, 8)}…
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{p.provider}</TableCell>
                    <TableCell className="font-semibold">
                      {p.amount.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {p.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString("tr-TR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewInvoice(p.id)}
                        disabled={loadingInvoice}
                        className="text-xs hover:text-primary gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Fatura
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invoice Receipt Modal Overlay */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b bg-slate-50 print:hidden">
              <span className="text-sm font-semibold text-slate-600 font-mono">E-Makbuz Detayı</span>
              <div className="flex gap-2">
                <Button onClick={handlePrint} size="sm" className="gap-1.5">
                  <Printer className="h-4 w-4" />
                  Yazdır / PDF Kaydet
                </Button>
                <Button onClick={() => setSelectedInvoice(null)} variant="ghost" size="sm" className="p-1">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Printable Area */}
            <div className="p-8 flex-1 overflow-y-auto print:overflow-visible print:p-4">
              
              {/* Receipt Branding */}
              <div className="flex justify-between items-start border-b pb-6 mb-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-800">TIBBİ DANIŞMANLIK PLATFORMU</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedInvoice.hospitalName || "Erciyes Üniversitesi Tıp Fakültesi"}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-base font-bold text-primary">E-HİZMET MAKBUZU</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">Tarih: {new Date(selectedInvoice.createdAt).toLocaleString("tr-TR")}</p>
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 gap-6 text-sm mb-6 border-b pb-6">
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Hizmet Alan (Hasta)</span>
                  <p className="font-semibold text-slate-800">{selectedInvoice.patientName}</p>
                  {selectedInvoice.patientNationalId && (
                    <p className="text-xs text-slate-600 font-mono mt-0.5">T.C.: {selectedInvoice.patientNationalId}</p>
                  )}
                  <p className="text-xs text-slate-600 mt-0.5">Tel: {selectedInvoice.patientPhone}</p>
                  <p className="text-xs text-slate-600">E-Posta: {selectedInvoice.patientEmail}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block mb-1">Hizmet Veren (Hekim)</span>
                  <p className="font-semibold text-slate-800">{selectedInvoice.doctorName || "Atanmamış / Havuz"}</p>
                  {selectedInvoice.professionName && (
                    <p className="text-xs text-slate-600 mt-0.5">Klinik: {selectedInvoice.professionName}</p>
                  )}
                  <p className="text-xs text-slate-600 mt-0.5">Kurum: {selectedInvoice.hospitalName || "Erciyes Hastanesi"}</p>
                </div>
              </div>

              {/* Receipt Details Table */}
              <div className="border rounded-lg overflow-hidden mb-6">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b text-slate-600 font-medium text-xs">
                    <tr>
                      <th className="p-3">Hizmet Açıklaması</th>
                      <th className="p-3 text-right">Referans No</th>
                      <th className="p-3 text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3 font-medium">
                        Tıbbi İkinci Görüş Raporlama ve Klinik Danışmanlık Hizmeti
                      </td>
                      <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                        {selectedInvoice.ecommerceNumber || selectedInvoice.applicationId.slice(0, 8)}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-800">
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
                    <span className="text-muted-foreground">Ara Toplam:</span>
                    <span>
                      {selectedInvoice.amount.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {selectedInvoice.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">KDV (%0 / Muaf):</span>
                    <span>0,00 {selectedInvoice.currency}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-bold text-base text-slate-800">
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
              <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 space-y-1 border border-slate-100">
                <p><span className="font-semibold">Ödeme Durumu:</span> {selectedInvoice.status.toUpperCase()}</p>
                <p><span className="font-semibold">Ödeme Kanalı:</span> {selectedInvoice.provider.toUpperCase()}</p>
                {selectedInvoice.providerTransactionId && (
                  <p className="font-mono"><span className="font-semibold font-sans">İşlem (TX) ID:</span> {selectedInvoice.providerTransactionId}</p>
                )}
                {selectedInvoice.paidAt && (
                  <p><span className="font-semibold">Ödeme Zamanı:</span> {new Date(selectedInvoice.paidAt).toLocaleString("tr-TR")}</p>
                )}
              </div>

              <div className="text-center mt-12 text-[10px] text-muted-foreground border-t pt-4">
                Bu belge dijital olarak oluşturulmuştur ve ıslak imza gerektirmez. Sorgulama ve doğrulama için başvuru ID kullanılabilir.
              </div>

            </div>

          </div>
        </div>
      )}
    </AdminAppShell>
  );
}
