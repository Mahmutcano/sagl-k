"use client";

import { useCallback, useEffect, useMemo, useState, Fragment, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { ApiError, api } from "@/lib/api";
import { requireSession, roleLabel } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { FormAlert, FormSelect } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
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
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string;
  createdAt: string;
  userEmail: string;
  userName: string;
  userRole?: string;
};

const ACTION_OPTIONS = [
  { value: "user_login", label: "Kullanıcı Girişi" },
  { value: "update_profile", label: "Profil Güncelleme" },
  { value: "change_phone", label: "Telefon Doğrulama" },
  { value: "start_application", label: "Başvuru Başlatma" },
  { value: "update_application", label: "Başvuru Güncelleme" },
  { value: "cancel_application", label: "Başvuru İptali" },
  { value: "delete_application", label: "Başvuru Silme" },
] as const;

const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  ACTION_OPTIONS.map((o) => [o.value, o.label])
);

const ENTITY_LABELS: Record<string, string> = {
  users: "Kullanıcı",
  applications: "Başvuru",
  hospitals: "Hastane",
  titles: "Unvan",
  payments: "Ödeme",
  http_request: "HTTP İstek",
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortenPath(path: string): string {
  return path
    .replace(/^\/api\/v1\//, "")
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/…");
}

function getActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const http = action.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
  if (http) {
    return `${http[1].toUpperCase()} · ${shortenPath(http[2])}`;
  }
  if (action.startsWith("admin_")) {
    return action
      .replace(/^admin_/, "")
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return action;
}

function getActionTone(action: string, statusCode?: number): string {
  if (statusCode != null && statusCode >= 400) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (
    action === "cancel_application" ||
    action === "delete_application" ||
    action.startsWith("DELETE ")
  ) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (action === "user_login") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  if (action === "change_phone" || action === "update_profile") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (action.startsWith("POST ") || action === "start_application") {
    return "border-violet-200 bg-violet-50 text-violet-800";
  }
  return "border-border bg-muted/60 text-foreground";
}

function payloadNumber(payload: Record<string, unknown> | null, key: string): number | undefined {
  if (!payload || payload[key] == null) return undefined;
  const n = Number(payload[key]);
  return Number.isFinite(n) ? n : undefined;
}

function payloadString(payload: Record<string, unknown> | null, key: string): string {
  if (!payload || payload[key] == null) return "";
  return String(payload[key]);
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default function AdminLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min((page + 1) * pageSize, totalCount);

  const load = useCallback(() => {
    const session = requireSession("admin");
    if (!session) {
      router.replace(ROUTES.admin.login);
      return;
    }
    setLoading(true);
    setError("");

    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search: searchQuery.trim(),
      action: actionFilter,
    });

    api<{ items: AuditLogItem[]; totalCount: number }>(
      `/api/v1/admin/audit-logs?${query}`,
      {},
      session.token
    )
      .then((res) => {
        setLogs(res?.items ?? []);
        setTotalCount(res?.totalCount ?? 0);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Sistem logları yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router, page, searchQuery, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters = Boolean(searchQuery.trim() || actionFilter);

  const pageButtons = useMemo(() => {
    const start = Math.max(0, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchText.trim());
  }

  function handleClearFilters() {
    setSearchText("");
    setSearchQuery("");
    setActionFilter("");
    setPage(0);
  }

  return (
    <AdminAppShell
      title="Sistem Aktivite Logları"
      description="Hasta ve doktor işlemlerinin özeti. Admin operasyonları bu listede yer almaz."
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Filtreler</CardTitle>
              <CardDescription>İsim, e-posta, IP veya eylem tipine göre daraltın.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={load}>
              <RotateCw className="h-4 w-4" />
              Yenile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearchSubmit} className="grid gap-3 md:grid-cols-[1fr_14rem_auto] md:items-end">
            <div className="space-y-1.5">
              <label htmlFor="log-search" className="text-sm font-medium">
                Arama
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="log-search"
                  className="pl-9"
                  placeholder="İsim, e-posta, IP veya endpoint…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>
            <FormSelect
              id="action-filter"
              label="Eylem"
              value={actionFilter}
              onChange={(e) => {
                setPage(0);
                setActionFilter(e.target.value);
              }}
              placeholder="Tüm eylemler"
              options={[...ACTION_OPTIONS]}
            />
            <div className="flex gap-2">
              {hasFilters ? (
                <Button type="button" variant="ghost" onClick={handleClearFilters} className="gap-1.5">
                  <X className="h-4 w-4" />
                  Temizle
                </Button>
              ) : null}
              <Button type="submit" className="gap-1.5">
                <Search className="h-4 w-4" />
                Ara
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            {hasFilters
              ? "Filtrelere uygun kayıt bulunamadı."
              : "Henüz listelenecek aktivite kaydı yok."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">{totalCount}</span> kayıt ·{" "}
              {rangeStart}–{rangeEnd} gösteriliyor
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[11rem]">Tarih</TableHead>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>Eylem</TableHead>
                    <TableHead className="w-[8rem]">Durum</TableHead>
                    <TableHead className="w-[8rem]">IP</TableHead>
                    <TableHead className="w-[5.5rem] text-right">Detay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const expanded = expandedLogId === log.id;
                    const statusCode = payloadNumber(log.payload, "statusCode");
                    const endpoint = payloadString(log.payload, "endpoint");
                    const method = payloadString(log.payload, "method");

                    return (
                      <Fragment key={log.id}>
                        <TableRow
                          className={cn(expanded && "bg-muted/20", "align-top")}
                        >
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[10rem] space-y-0.5">
                              <p className="font-medium leading-snug">
                                {log.userName?.trim() || "Misafir"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {log.userEmail || "—"}
                              </p>
                              {log.userRole ? (
                                <Badge variant="secondary" className="mt-1 font-normal">
                                  {roleLabel(log.userRole)}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[22rem] space-y-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "whitespace-normal text-left font-medium",
                                  getActionTone(log.action, statusCode)
                                )}
                              >
                                {getActionLabel(log.action)}
                              </Badge>
                              {endpoint ? (
                                <p className="truncate font-mono text-[11px] text-muted-foreground">
                                  {method ? `${method} ` : ""}
                                  {shortenPath(endpoint)}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            {statusCode != null ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-mono",
                                  statusCode >= 400
                                    ? "border-rose-200 bg-rose-50 text-rose-800"
                                    : statusCode >= 300
                                      ? "border-amber-200 bg-amber-50 text-amber-900"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                )}
                              >
                                {statusCode}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {log.ipAddress || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => setExpandedLogId(expanded ? null : log.id)}
                              aria-expanded={expanded}
                            >
                              {expanded ? (
                                <>
                                  Gizle <ChevronUp className="h-3.5 w-3.5" />
                                </>
                              ) : (
                                <>
                                  Aç <ChevronDown className="h-3.5 w-3.5" />
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={6} className="p-4">
                              <div className="space-y-4 rounded-lg border bg-background p-4">
                                <div>
                                  <p className="mb-2 text-sm font-semibold">İşlem Özeti</p>
                                  <dl className="grid gap-2 text-sm">
                                    <DetailRow label="Eylem">{getActionLabel(log.action)}</DetailRow>
                                    <DetailRow label="Ham kod">
                                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                        {log.action}
                                      </code>
                                    </DetailRow>
                                    {log.entityType ? (
                                      <DetailRow label="Nesne">
                                        {ENTITY_LABELS[log.entityType] ?? log.entityType}
                                        {log.entityId ? (
                                          <span className="ml-1 font-mono text-xs text-muted-foreground">
                                            ({log.entityId})
                                          </span>
                                        ) : null}
                                      </DetailRow>
                                    ) : null}
                                    {method || endpoint ? (
                                      <DetailRow label="Endpoint">
                                        <code className="font-mono text-xs">
                                          {method} {endpoint}
                                        </code>
                                      </DetailRow>
                                    ) : null}
                                    {statusCode != null ? (
                                      <DetailRow label="HTTP Durumu">{statusCode}</DetailRow>
                                    ) : null}
                                    {payloadString(log.payload, "userName") ? (
                                      <DetailRow label="İşlemi Yapan">
                                        {payloadString(log.payload, "userName")}
                                      </DetailRow>
                                    ) : null}
                                    {payloadString(log.payload, "userRole") ? (
                                      <DetailRow label="Rol">
                                        {roleLabel(payloadString(log.payload, "userRole"))}
                                      </DetailRow>
                                    ) : null}
                                    {payloadString(log.payload, "query") ? (
                                      <DetailRow label="Sorgu">
                                        <code className="font-mono text-xs">
                                          {payloadString(log.payload, "query")}
                                        </code>
                                      </DetailRow>
                                    ) : null}
                                  </dl>
                                </div>

                                {log.payload ? (
                                  <details className="rounded-md border bg-muted/20">
                                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                                      Ham JSON verisi
                                    </summary>
                                    <pre className="max-h-64 overflow-auto border-t bg-foreground/95 p-3 font-mono text-[11px] leading-relaxed text-muted">
                                      {JSON.stringify(log.payload, null, 2)}
                                    </pre>
                                  </details>
                                ) : (
                                  <p className="text-sm italic text-muted-foreground">
                                    Ek veri detayı yok.
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="flex flex-col items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Sayfa <span className="font-semibold text-foreground">{page + 1}</span> / {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pageButtons.map((i) => (
                <Button
                  key={i}
                  type="button"
                  variant={i === page ? "default" : "outline"}
                  size="sm"
                  className="h-8 min-w-8 px-2"
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminAppShell>
  );
}
