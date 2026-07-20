"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole, fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert } from "@/components/FormField";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Bell, Smartphone, Mail, Calculator, RefreshCw, Download } from "lucide-react";

type Overview = {
  payments: {
    paidCount: number;
    paidTotal: number;
    pendingCount: number;
    failedCount: number;
    refundedCount: number;
    refundedTotal: number;
  };
  notifications: { smsSent: number; smsFailed: number; emailSent: number; emailFailed: number };
  invoices: { issued: number; failed: number; pending: number };
  applications: { paymentCompleted: number; paymentPending: number };
  earningsEstimate: {
    vatRate: number;
    defaultDoctorSharePercent: number;
    grossPaid: number;
    vatAmount: number;
    netAmount: number;
    doctorShareEstimate: number;
    institutionShareEstimate: number;
  };
};

type DoctorRow = {
  doctorId: string;
  doctorName: string;
  title?: string;
  revenueSharePercent: number;
  paymentCount: number;
  grossAmount: number;
  doctorShare: number;
  institutionShare: number;
  refundedAmount: number;
};

function money(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace(ROUTES.admin.login);
      return;
    }
    setLoading(true);
    setError("");
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    const qs = q.toString() ? `?${q}` : "";
    Promise.all([
      api<Overview>(`${API.admin.reportsOverview}${qs}`, {}, token),
      api<{ items: DoctorRow[] }>(`${API.admin.doctorEarnings}${qs}`, {}, token),
    ])
      .then(([ov, earn]) => {
        setOverview(ov);
        setDoctors(earn?.items ?? []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Raporlar yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportDoctorCSV() {
    const token = getToken();
    if (!token) return;
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    const res = await fetchTextWithAuth(`${API.admin.doctorEarningsExport}?${q}`, {}, token);
    if (!res.ok) {
      setError("CSV indirilemedi.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "doktor_kazanc.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const links = [
    { href: ROUTES.admin.payments, label: "Ödeme Raporu", desc: "PAYTR, fatura, OID, callback", icon: CreditCard },
    { href: ROUTES.admin.refunds, label: "İadeler", desc: "Liste + panel iade kaydı", icon: RefreshCw },
    { href: `${ROUTES.admin.notifications}?channel=sms`, label: "SMS Raporu", desc: "Gönderilen / başarısız SMS", icon: Smartphone },
    { href: `${ROUTES.admin.notifications}?channel=email`, label: "E-posta Raporu", desc: "Gönderilen / başarısız e-posta", icon: Mail },
    { href: ROUTES.admin.accounting, label: "Muhasebe Defteri", desc: "KDV ve pay kırılımı", icon: Calculator },
    { href: ROUTES.admin.smsLogs, label: "OTP SMS Logları", desc: "Doğrulama kodları", icon: Bell },
  ];

  return (
    <AdminAppShell title="Rapor Merkezi" description="Ödeme, bildirim, fatura ve doktor kazanç özeti">
      {error ? <FormAlert title="Hata" message={error} /> : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <CustomDatePicker id="repStart" label="Başlangıç" value={startDate} onChange={setStartDate} />
        <CustomDatePicker id="repEnd" label="Bitiş" value={endDate} onChange={setEndDate} />
        <Button type="button" variant="outline" onClick={() => { setStartDate(""); setEndDate(""); }}>
          Temizle
        </Button>
      </div>

      {loading || !overview ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription>Ödenen</CardDescription>
                <CardTitle className="text-2xl">{money(overview.payments.paidTotal)} ₺</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {overview.payments.paidCount} ödeme · bekleyen {overview.payments.pendingCount} · başarısız{" "}
                {overview.payments.failedCount}
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription>İade</CardDescription>
                <CardTitle className="text-2xl">{money(overview.payments.refundedTotal)} ₺</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {overview.payments.refundedCount} iade kaydı
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription>SMS / E-posta</CardDescription>
                <CardTitle className="text-2xl">
                  {overview.notifications.smsSent + overview.notifications.emailSent}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                SMS {overview.notifications.smsSent}/{overview.notifications.smsFailed} · Mail{" "}
                {overview.notifications.emailSent}/{overview.notifications.emailFailed}
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription>Doktor payı (tahmini)</CardDescription>
                <CardTitle className="text-2xl">
                  {money(overview.earningsEstimate.doctorShareEstimate)} ₺
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Varsayılan %{overview.earningsEstimate.defaultDoctorSharePercent} · KDV %
                {overview.earningsEstimate.vatRate} · Kurum{" "}
                {money(overview.earningsEstimate.institutionShareEstimate)} ₺
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="block">
                <Card className="rounded-2xl transition hover:border-primary/40 hover:shadow-sm h-full">
                  <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                    <l.icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{l.label}</CardTitle>
                      <CardDescription>{l.desc}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>

          <Card className="mt-6 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Doktor kazançları</CardTitle>
                <CardDescription>Ödenen başvurulardan doktora düşen pay (KDV ayrıştırılmış)</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void exportDoctorCSV()}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {doctors.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Bu aralıkta doktor kazancı yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doktor</TableHead>
                      <TableHead>Pay %</TableHead>
                      <TableHead>Adet</TableHead>
                      <TableHead>Brüt</TableHead>
                      <TableHead>Doktor payı</TableHead>
                      <TableHead>Kurum</TableHead>
                      <TableHead>İade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.map((d) => (
                      <TableRow key={d.doctorId}>
                        <TableCell>
                          <span className="font-semibold">{d.doctorName}</span>
                          {d.title ? <span className="mt-0.5 block text-[10px] text-muted-foreground">{d.title}</span> : null}
                        </TableCell>
                        <TableCell>%{d.revenueSharePercent}</TableCell>
                        <TableCell>{d.paymentCount}</TableCell>
                        <TableCell>{money(d.grossAmount)}</TableCell>
                        <TableCell className="font-semibold">{money(d.doctorShare)}</TableCell>
                        <TableCell>{money(d.institutionShare)}</TableCell>
                        <TableCell>
                          {d.refundedAmount > 0 ? (
                            <Badge variant="secondary">{money(d.refundedAmount)}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AdminAppShell>
  );
}
