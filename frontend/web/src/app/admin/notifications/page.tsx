"use client";

import { ROUTES } from "@/lib/routes";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole, fetchTextWithAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert } from "@/components/FormField";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Eye, Search, X } from "lucide-react";

type NotificationLog = {
  id: string;
  channel: string;
  recipient: string;
  templateKey: string;
  status: string;
  subject?: string;
  bodyPreview?: string;
  applicationId?: string;
  createdAt?: string;
};

type NotificationDetail = {
  id: string;
  channel: string;
  recipient: string;
  subject?: string;
  body?: string;
  templateKey?: string;
  status: string;
  createdAt?: string;
  sentAt?: string;
};

export default function AdminNotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [channel, setChannel] = useState(searchParams.get("channel") || "");
  const [status, setStatus] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detail, setDetail] = useState<NotificationDetail | null>(null);

  useEffect(() => {
    const ch = searchParams.get("channel") || "";
    setChannel(ch);
  }, [searchParams]);

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
    const q = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search: searchQuery,
      startDate,
      endDate,
    });
    if (channel) q.set("channel", channel);
    if (status) q.set("status", status);
    api<{ items: NotificationLog[]; totalCount: number }>(`${API.admin.notifications}?${q}`, {}, token)
      .then((res) => {
        setItems(res?.items ?? []);
        setTotal(res?.totalCount ?? 0);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Bildirimler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router, page, searchQuery, startDate, endDate, channel, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(id: string) {
    const token = getToken();
    if (!token) return;
    try {
      const d = await api<NotificationDetail>(API.admin.notificationDetail(id), {}, token);
      setDetail(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Detay yüklenemedi.");
    }
  }

  async function exportCSV() {
    const token = getToken();
    if (!token) return;
    const q = new URLSearchParams();
    if (channel) q.set("channel", channel);
    const res = await fetchTextWithAuth(`${API.admin.notificationsExport}?${q}`, {}, token);
    if (!res.ok) {
      setError("CSV indirilemedi.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bildirimler_${channel || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const title =
    channel === "sms" ? "SMS Raporu" : channel === "email" ? "E-posta Raporu" : "SMS / E-posta Raporu";

  return (
    <AdminAppShell title={title} description="Operasyonel bildirim logları — şablon, alıcı, durum">
      {error ? <FormAlert title="Hata" message={error} /> : null}

      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setSearchQuery(searchText);
        }}
      >
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Alıcı, şablon, içerik…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <select className="h-10 rounded-xl border px-3 text-sm" value={channel} onChange={(e) => { setPage(0); setChannel(e.target.value); }}>
          <option value="">Tüm kanallar</option>
          <option value="sms">SMS</option>
          <option value="email">E-posta</option>
        </select>
        <select className="h-10 rounded-xl border px-3 text-sm" value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}>
          <option value="">Tüm durumlar</option>
          <option value="sent">Gönderildi</option>
          <option value="failed">Başarısız</option>
          <option value="pending">Bekliyor</option>
        </select>
        <CustomDatePicker id="nStart" label="Başlangıç" value={startDate} onChange={(v) => { setPage(0); setStartDate(v); }} />
        <CustomDatePicker id="nEnd" label="Bitiş" value={endDate} onChange={(v) => { setPage(0); setEndDate(v); }} />
        <Button type="submit">Ara</Button>
        <Button type="button" variant="outline" className="gap-1.5" onClick={() => void exportCSV()}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </form>

      {loading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : items.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center text-sm text-muted-foreground">Kayıt yok.</CardContent></Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Alıcı</TableHead>
                  <TableHead>Şablon</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="uppercase text-xs font-bold">{n.channel}</TableCell>
                    <TableCell className="font-mono text-xs">{n.recipient}</TableCell>
                    <TableCell className="text-xs">{n.templateKey || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={n.status === "sent" ? "default" : n.status === "failed" ? "destructive" : "secondary"}>
                        {n.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString("tr-TR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => void openDetail(n.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs">
            <span>Toplam {total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
            </div>
          </div>
        </Card>
      )}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">Bildirim detayı</CardTitle>
                <CardDescription className="font-mono text-xs">{detail.id}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDetail(null)}><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Kanal:</span> {detail.channel}</p>
              <p><span className="text-muted-foreground">Alıcı:</span> {detail.recipient}</p>
              <p><span className="text-muted-foreground">Durum:</span> {detail.status}</p>
              {detail.subject ? <p><span className="text-muted-foreground">Konu:</span> {detail.subject}</p> : null}
              {detail.templateKey ? <p><span className="text-muted-foreground">Şablon:</span> {detail.templateKey}</p> : null}
              <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{detail.body || "—"}</pre>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AdminAppShell>
  );
}
