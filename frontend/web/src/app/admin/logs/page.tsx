"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { ApiError, api } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormAlert, FormSelect } from "@/components/FormField";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RotateCw, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function AdminLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");

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
    }).toString();

    api<{ items: AuditLogItem[]; totalCount: number }>(`/api/v1/admin/audit-logs?${query}`, {}, session.token)
      .then((res) => {
        setLogs(res?.items ?? []);
        setTotalCount(res?.totalCount ?? 0);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Sistem logları yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router, page, pageSize, searchQuery, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchText);
  };

  const handleClearFilters = () => {
    setSearchText("");
    setSearchQuery("");
    setActionFilter("");
    setPage(0);
  };

  function getActionLabel(action: string): string {
    if (action.startsWith("POST ") || action.startsWith("PUT ") || action.startsWith("PATCH ") || action.startsWith("DELETE ")) {
      return action;
    }
    switch (action) {
      case "user_login":
        return "Kullanıcı Girişi";
      case "update_profile":
        return "Profil Güncelleme";
      case "change_phone":
        return "Telefon Doğrulama";
      case "start_application":
        return "Başvuru Başlatma";
      case "update_application":
        return "Başvuru Güncelleme";
      case "cancel_application":
        return "Başvuru İptali";
      case "delete_application":
        return "Başvuru Silme";
      default:
        return action;
    }
  }

  function getActionColorClass(action: string): string {
    if (action.startsWith("admin_")) {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }
    switch (action) {
      case "user_login":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "change_phone":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "cancel_application":
      case "delete_application":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-muted text-foreground ";
    }
  }

  function formatDateTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString("tr-TR", {
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

  return (
    <AdminAppShell
      title="Sistem Aktivite Logları"
      description="Hasta ve doktor işlemleri. Endpoint, durum kodu ve isim bilgisi veri detayında görünür. Admin işlemleri listelenmez."
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {/* Premium Filter Bar */}
      <div className="mb-4 flex min-w-0 flex-col justify-between gap-3 print:hidden md:mb-6 md:flex-row md:items-end">
        <form onSubmit={handleSearchSubmit} className="admin-filter-bar min-w-0 flex-grow rounded-xl border /80 bg-white p-3 sm:rounded-2xl sm:p-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="search" className="text-xs font-bold text-foreground tracking-wide">Arama</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                className="pl-10 h-10 focus-visible:ring-primary/20 focus-visible:border-primary bg-white rounded-xl "
                placeholder="İsim, e-posta veya IP yazın..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>
          <div>
            <FormSelect
              id="action-filter"
              label="Eylem Tipi Filtresi"
              value={actionFilter}
              onChange={(e) => { setPage(0); setActionFilter(e.target.value); }}
              placeholder="Tüm Eylemler"
              options={[
                { value: "user_login", label: "Kullanıcı Girişi" },
                { value: "update_profile", label: "Profil Güncelleme" },
                { value: "change_phone", label: "Telefon Doğrulama" },
                { value: "start_application", label: "Başvuru Başlatma" },
                { value: "update_application", label: "Başvuru Güncelleme" },
                { value: "cancel_application", label: "Başvuru İptali" },
                { value: "delete_application", label: "Başvuru Silme" },
              ]}
            />
          </div>
          <div className="flex gap-2.5 justify-end mt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters} className="h-9 font-bold hover:bg-muted rounded-xl">
              Temizle
            </Button>
            <Button type="submit" size="sm" className="h-9 gap-1.5 font-bold shadow-primary/10 rounded-xl px-5">
              <Search className="h-4 w-4" />
              Ara
            </Button>
          </div>
        </form>

        <Button variant="outline" onClick={load} className="gap-2 h-10 self-end font-bold rounded-xl hover:bg-muted shadow-sm">
          <RotateCw className="h-4 w-4" />
          Yenile
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground font-medium italic border border-dashed rounded-2xl bg-white shadow-sm">
          Kriterlere uygun herhangi bir aktivite logu kaydı bulunamadı.
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-muted-foreground font-semibold px-2">
            Toplam {totalCount} log kaydı bulundu.
          </div>

          <div className="admin-table-scroll overflow-hidden rounded-xl border bg-white sm:rounded-2xl">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/40 font-bold text-muted-foreground text-xs">
                  <th className="p-4 uppercase tracking-wider">Tarih</th>
                  <th className="p-4 uppercase tracking-wider">Kullanıcı</th>
                  <th className="p-4 uppercase tracking-wider">İşlem / Eylem</th>
                  <th className="p-4 uppercase tracking-wider">IP Adresi</th>
                  <th className="p-4 text-right uppercase tracking-wider">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <caption key={log.id} className="table-row-group text-left text-foreground">
                      <tr className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-xs font-mono text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-foreground block text-xs">{log.userName || "Misafir"}</span>
                          <span className="text-[10px] text-muted-foreground block font-mono mt-0.5">{log.userEmail || "—"}</span>
                          {log.userRole ? (
                            <span className="mt-0.5 block text-[10px] font-medium text-primary">{log.userRole}</span>
                          ) : null}
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className={`text-[10px] font-bold border ${getActionColorClass(log.action)}`}>
                            {getActionLabel(log.action)}
                          </Badge>
                        </td>
                        <td className="p-4 font-mono text-xs text-muted-foreground">{log.ipAddress || "—"}</td>
                        <td className="p-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-xs font-semibold"
                          >
                            {isExpanded ? "Gizle" : "Göster"}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="p-4 bg-muted/30 border-t border-b">
                            <div className="text-xs space-y-3">
                              <p className="font-semibold text-foreground">İşlem özeti</p>
                              {log.payload ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {"userName" in log.payload && log.payload.userName ? (
                                    <p><span className="text-muted-foreground">Hasta/Doktor:</span> <strong>{String(log.payload.userName)}</strong></p>
                                  ) : null}
                                  {"endpoint" in log.payload && log.payload.endpoint ? (
                                    <p><span className="text-muted-foreground">Endpoint:</span> <code className="font-mono">{String(log.payload.method || "")} {String(log.payload.endpoint)}</code></p>
                                  ) : null}
                                  {"statusCode" in log.payload && log.payload.statusCode != null ? (
                                    <p>
                                      <span className="text-muted-foreground">HTTP:</span>{" "}
                                      <strong className={Number(log.payload.statusCode) >= 400 ? "text-destructive" : ""}>
                                        {String(log.payload.statusCode)}
                                      </strong>
                                      {log.payload.error ? " (hata)" : ""}
                                    </p>
                                  ) : null}
                                  {"userRole" in log.payload && log.payload.userRole ? (
                                    <p><span className="text-muted-foreground">Rol:</span> {String(log.payload.userRole)}</p>
                                  ) : null}
                                </div>
                              ) : null}
                              {log.payload ? (
                                <pre className="bg-foreground text-muted-foreground p-4 rounded-xl overflow-x-auto font-mono text-[11px] leading-relaxed max-w-full shadow-inner max-h-72">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              ) : (
                                <p className="text-muted-foreground italic">Veri detayı bulunmuyor.</p>
                              )}
                              {log.entityId && (
                                <p className="text-muted-foreground font-mono text-[10px]">
                                  Etkilenen Nesne (Entity): {log.entityType} ({log.entityId})
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </caption>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Premium Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/40 border /50 rounded-2xl px-6 py-4 mt-2 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground tracking-wide font-sans">
              Toplam <span className="text-primary font-bold">{totalCount}</span> logtan {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} arası listeleniyor
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
    </AdminAppShell>
  );
}
