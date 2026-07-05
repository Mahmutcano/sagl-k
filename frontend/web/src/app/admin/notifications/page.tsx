"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
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

type NotificationLog = {
  id: string;
  channel: string;
  recipient: string;
  templateKey: string;
  status: string;
  createdAt?: string;
};

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationLog[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <AdminAppShell title="Bildirimler" description="SMS ve e-posta gönderim günlüğü">
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
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Alıcı</TableHead>
                  <TableHead>Şablon</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <Badge variant="outline">{n.channel}</Badge>
                    </TableCell>
                    <TableCell>{n.recipient}</TableCell>
                    <TableCell>{n.templateKey}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{n.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {n.createdAt ? new Date(n.createdAt).toLocaleString("tr-TR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AdminAppShell>
  );
}
