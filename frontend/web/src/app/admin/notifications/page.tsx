"use client";

import { ROUTES } from "@/lib/routes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
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
import { Eye, X } from "lucide-react";

type NotificationLog = {
  id: string;
  channel: string;
  recipient: string;
  templateKey: string;
  status: string;
  createdAt?: string;
};

type NotificationDetail = {
  id: string;
  channel: string;
  recipient: string;
  subject?: string;
  body?: string;
  templateKey: string;
  status: string;
  providerResponse?: any;
  createdAt: string;
  sentAt?: string;
};

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationLog[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedNotif, setSelectedNotif] = useState<NotificationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace(ROUTES.admin.login);
      return;
    }
    api<NotificationLog[]>(API.admin.notifications, {}, token)
      .then((rows) => setItems(rows ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Kayıtlar yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleViewDetail(id: string) {
    const token = getToken();
    if (!token) return;
    setLoadingDetail(true);
    setError("");
    try {
      const details = await api<NotificationDetail>(API.admin.notificationDetail(id), {}, token);
      setSelectedNotif(details);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bildirim detayları alınamadı.");
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <AdminAppShell title="Bildirimler" description="Sistem tarafından gönderilen e-posta ve SMS hareketleri">
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <CardHeader className="p-0">
              <CardTitle>Kayıt yok</CardTitle>
              <CardDescription>Gönderilen bildirimler burada listelenir.</CardDescription>
            </CardHeader>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md border-slate-200">
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Alıcı</TableHead>
                  <TableHead>Şablon</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <Badge variant="outline" className="uppercase font-mono text-[10px]">
                        {n.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-xs">{n.recipient}</TableCell>
                    <TableCell className="font-mono text-xs">{n.templateKey}</TableCell>
                    <TableCell>
                      <Badge variant={n.status === "sent" || n.status === "delivered" ? "default" : "destructive"}>
                        {n.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString("tr-TR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetail(n.id)}
                        disabled={loadingDetail}
                        className="text-xs hover:text-primary gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Görüntüle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notification Preview Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">Bildirim Detayları ve Önizleme</span>
              <Button onClick={() => setSelectedNotif(null)} variant="ghost" size="sm" className="p-1">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border rounded-lg p-3 bg-slate-50/50">
                <div>
                  <span className="text-muted-foreground block">Gönderim Kanalı</span>
                  <span className="font-semibold capitalize text-slate-800">{selectedNotif.channel}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Alıcı</span>
                  <span className="font-semibold text-slate-800 font-mono">{selectedNotif.recipient}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Şablon (Template)</span>
                  <span className="font-semibold text-slate-800 font-mono">{selectedNotif.templateKey || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Durum</span>
                  <Badge variant={selectedNotif.status === "sent" || selectedNotif.status === "delivered" ? "default" : "destructive"} className="mt-0.5">
                    {selectedNotif.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block">Oluşturulma</span>
                  <span className="text-slate-700">{new Date(selectedNotif.createdAt).toLocaleString("tr-TR")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Gönderilme</span>
                  <span className="text-slate-700">{selectedNotif.sentAt ? new Date(selectedNotif.sentAt).toLocaleString("tr-TR") : "—"}</span>
                </div>
              </div>

              {/* Subject */}
              {selectedNotif.subject && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">Konu / Başlık</span>
                  <div className="border rounded-md px-3 py-2 bg-slate-50 font-medium text-sm text-slate-800">
                    {selectedNotif.subject}
                  </div>
                </div>
              )}

              {/* Message Body Content */}
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Mesaj İçeriği</span>
                <div 
                  className="border rounded-lg p-4 bg-slate-50 text-sm overflow-x-auto min-h-[120px] max-h-[300px] font-sans text-slate-700 whitespace-pre-wrap"
                  style={{ wordBreak: "break-all" }}
                >
                  {selectedNotif.body || "İçerik bulunamadı."}
                </div>
              </div>

              {/* Provider raw Response */}
              {selectedNotif.providerResponse && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Sağlayıcı Yanıtı (Raw API Log)</span>
                  <pre className="text-[11px] font-mono border rounded-lg p-3 bg-slate-900 text-slate-200 overflow-x-auto max-h-[150px]">
                    {JSON.stringify(selectedNotif.providerResponse, null, 2)}
                  </pre>
                </div>
              )}

            </div>
            
            {/* Footer */}
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <Button onClick={() => setSelectedNotif(null)} size="sm">
                Kapat
              </Button>
            </div>

          </div>
        </div>
      )}
    </AdminAppShell>
  );
}
