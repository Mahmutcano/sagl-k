"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import { AdminAppShell } from "@/components/AdminAppShell";
import { DatePickerField } from "@/components/DatePickerField";
import { FormAlert, TextInput } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Settings2 } from "lucide-react";

type Settings = {
  vatRate: number;
  defaultDoctorSharePercent: number;
};

type LedgerItem = {
  paymentId: string;
  applicationId: string;
  applicationNumber: string;
  patientName: string;
  doctorName: string;
  revenueSharePercent: number;
  grossAmount: number;
  vatRate: number;
  vatAmount: number;
  netAmount: number;
  doctorShare: number;
  institutionShare: number;
  paidAt: string;
};

type Summary = {
  count: number;
  grossTotal: number;
  vatTotal: number;
  netTotal: number;
  doctorTotal: number;
  institutionTotal: number;
  vatRate: number;
};

function money(n: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminAccountingPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [settings, setSettings] = useState<Settings>({ vatRate: 20, defaultDoctorSharePercent: 70 });
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

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
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    if (search.trim()) q.set("search", search.trim());

    Promise.all([
      api<Settings>(API.admin.accountingSettings, {}, token),
      api<{ items: LedgerItem[]; summary: Summary }>(
        `${API.admin.accountingReport}?${q}`,
        {},
        token
      ),
    ])
      .then(([s, report]) => {
        setSettings(s ?? { vatRate: 20, defaultDoctorSharePercent: 70 });
        setItems(report?.items ?? []);
        setSummary(report?.summary ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Hesaplar yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router, dateFrom, dateTo, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSavingSettings(true);
    setSuccess("");
    setError("");
    try {
      await api(
        API.admin.accountingSettings,
        { method: "PUT", body: JSON.stringify(settings) },
        token
      );
      setSuccess("Muhasebe ayarları kaydedildi.");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ayarlar kaydedilemedi.");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <AdminAppShell
      title="Hesaplar"
      description="Ödemelerden KDV, doktor ve kurum paylarını otomatik hesaplayın; muhasebe özetini raporlayın."
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {success ? <FormAlert title="Başarılı" message={success} variant="default" /> : null}

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            Muhasebe ayarları
          </CardTitle>
          <CardDescription>
            KDV oranı brüt tutardan ayrılır; doktor payı net üzerinden hesaplanır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSettings} className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <TextInput
              id="vatRate"
              label="KDV oranı (%)"
              type="number"
              min={0}
              max={100}
              value={String(settings.vatRate)}
              onChange={(e) => setSettings((s) => ({ ...s, vatRate: Number(e.target.value) }))}
            />
            <TextInput
              id="defaultDoctorSharePercent"
              label="Varsayılan doktor payı (%)"
              type="number"
              min={0}
              max={100}
              value={String(settings.defaultDoctorSharePercent)}
              onChange={(e) =>
                setSettings((s) => ({ ...s, defaultDoctorSharePercent: Number(e.target.value) }))
              }
            />
            <Button type="submit" disabled={savingSettings} className="h-10">
              {savingSettings ? "Kaydediliyor..." : "Ayarları kaydet"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-4 overflow-visible">
        <CardContent className="space-y-3 p-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Hasta, doktor veya başvuru no"
                className="h-10 pl-9"
              />
            </div>
            <Button type="submit" variant="secondary" className="h-10">
              Ara
            </Button>
          </form>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DatePickerField
              id="accFrom"
              label="Başlangıç"
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="Başlangıç tarihi"
              max={dateTo || undefined}
            />
            <DatePickerField
              id="accTo"
              label="Bitiş"
              value={dateTo}
              onChange={setDateTo}
              placeholder="Bitiş tarihi"
              min={dateFrom || undefined}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardDescription>Brüt (KDV dahil)</CardDescription>
                <CardTitle className="text-lg">{money(summary?.grossTotal ?? 0)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardDescription>KDV (%{summary?.vatRate ?? settings.vatRate})</CardDescription>
                <CardTitle className="text-lg">{money(summary?.vatTotal ?? 0)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardDescription>Net</CardDescription>
                <CardTitle className="text-lg">{money(summary?.netTotal ?? 0)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardDescription>Doktor payı</CardDescription>
                <CardTitle className="text-lg text-emerald-700">{money(summary?.doctorTotal ?? 0)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardDescription>Kurum payı</CardDescription>
                <CardTitle className="text-lg">{money(summary?.institutionTotal ?? 0)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Hareket listesi</CardTitle>
              <CardDescription>
                {summary?.count ?? 0} ödeme · tutarlar KDV dahil brüt üzerinden ayrıştırılır
              </CardDescription>
            </CardHeader>
            <CardContent className="admin-table-scroll p-0">
              {items.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Seçilen aralıkta ödeme kaydı yok.
                </p>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="px-4">Tarih</TableHead>
                      <TableHead className="px-4">Başvuru</TableHead>
                      <TableHead className="px-4">Hasta</TableHead>
                      <TableHead className="px-4">Doktor</TableHead>
                      <TableHead className="px-4 text-right">Brüt</TableHead>
                      <TableHead className="px-4 text-right">KDV</TableHead>
                      <TableHead className="px-4 text-right">Net</TableHead>
                      <TableHead className="px-4 text-right">Dr %</TableHead>
                      <TableHead className="px-4 text-right">Doktor</TableHead>
                      <TableHead className="px-4 text-right">Kurum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow key={row.paymentId}>
                        <TableCell className="px-4 text-xs whitespace-nowrap">
                          {formatDate(row.paidAt)}
                        </TableCell>
                        <TableCell className="px-4 font-medium">{row.applicationNumber || "—"}</TableCell>
                        <TableCell className="px-4">{row.patientName}</TableCell>
                        <TableCell className="px-4">{row.doctorName}</TableCell>
                        <TableCell className="px-4 text-right tabular-nums">{money(row.grossAmount)}</TableCell>
                        <TableCell className="px-4 text-right tabular-nums">{money(row.vatAmount)}</TableCell>
                        <TableCell className="px-4 text-right tabular-nums">{money(row.netAmount)}</TableCell>
                        <TableCell className="px-4 text-right">%{row.revenueSharePercent}</TableCell>
                        <TableCell className="px-4 text-right tabular-nums text-emerald-700">
                          {money(row.doctorShare)}
                        </TableCell>
                        <TableCell className="px-4 text-right tabular-nums">
                          {money(row.institutionShare)}
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
