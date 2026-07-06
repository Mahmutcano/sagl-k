"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { ApiError, api } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/FormField";

type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, any> | null;
  ipAddress: string;
  createdAt: string;
  userEmail: string;
  userName: string;
};

export default function AdminLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const load = useCallback(() => {
    const session = requireSession("admin");
    if (!session) {
      router.replace(ROUTES.admin.login);
      return;
    }
    setLoading(true);
    setError("");
    api<AuditLogItem[]>("/api/v1/admin/audit-logs", {}, session.token)
      .then((data) => setLogs(data ?? []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Sistem logları yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function getActionLabel(action: string): string {
    switch (action) {
      case "user_login":
        return "Kullanıcı Girişi";
      case "update_profile":
        return "Profil Güncelleme";
      case "change_phone":
        return "Telefon Doğrulama";
      case "admin_update_user":
        return "Admin: Kullanıcı Düzenleme";
      case "admin_update_application":
        return "Admin: Başvuru Düzenleme";
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
        return "bg-slate-100 text-slate-800 border-slate-200";
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
      description="Sistem genelinde son 7 günde gerçekleşen girişler, veri güncellemeleri ve yönetici müdahalelerinin işlem geçmişi."
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">İşlem logları yükleniyor...</div>
      ) : logs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Son 1 haftaya ait herhangi bir aktivite kaydı bulunamadı.</Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Toplam {logs.length} işlem kaydı listeleniyor (7 günlük saklama politikası aktiftir)
            </span>
            <Button variant="outline" size="sm" onClick={load} className="cursor-pointer">
              Yenile
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 font-medium text-muted-foreground">
                  <th className="p-4">Tarih</th>
                  <th className="p-4">Kullanıcı</th>
                  <th className="p-4">İşlem / Eylem</th>
                  <th className="p-4">IP Adresi</th>
                  <th className="p-4">Hedef Nesne</th>
                  <th className="p-4 text-right">Detaylar</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <>
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-mono text-xs text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="p-4">
                          {log.userName ? (
                            <div>
                              <p className="font-semibold text-foreground leading-none">{log.userName}</p>
                              <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Sistem / Ziyaretçi</span>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className={getActionColorClass(log.action)}>
                            {getActionLabel(log.action)}
                          </Badge>
                        </td>
                        <td className="p-4 font-mono text-xs text-muted-foreground">
                          {log.ipAddress || "-"}
                        </td>
                        <td className="p-4 text-xs font-mono">
                          {log.entityType ? (
                            <div>
                              <span className="font-semibold text-foreground uppercase">{log.entityType}</span>
                              {log.entityId ? (
                                <p className="text-muted-foreground text-[10px] truncate max-w-[150px]">{log.entityId}</p>
                              ) : null}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="cursor-pointer text-xs"
                          >
                            {isExpanded ? "Kapat" : "Göster"}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-slate-50/50">
                          <td colSpan={6} className="p-4 border-t border-b">
                            <div className="rounded-lg border bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto max-w-4xl">
                              <p className="text-slate-400 mb-2">// İşlem Detayları & Payload Verisi (JSON)</p>
                              <pre>{JSON.stringify(log.payload || {}, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminAppShell>
  );
}
