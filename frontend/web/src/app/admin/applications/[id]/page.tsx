"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken, getUser, isAdminRole, clearAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { STATUS_LABELS, statusVariant, type StatusHistoryItem } from "@/lib/application";
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

export default function AdminApplicationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
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
    api<StatusHistoryItem[]>(API.admin.applicationHistory(params.id), {}, token)
      .then(setHistory)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Geçmiş yüklenemedi."))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  return (
    <AdminAppShell title="Başvuru geçmişi" description={params.id}>
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href={ROUTES.admin.home}>← Özete dön</Link>
      </Button>
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Kayıt yok</CardTitle>
              <CardDescription>Durum geçmişi bulunamadı.</CardDescription>
            </CardHeader>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Önceki</TableHead>
                  <TableHead>Yeni</TableHead>
                  <TableHead>Not</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {h.oldStatusCode != null
                        ? STATUS_LABELS[h.oldStatusCode] ?? h.oldStatusCode
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(h.newStatusCode)}>
                        {STATUS_LABELS[h.newStatusCode] ?? h.newStatusCode}
                      </Badge>
                    </TableCell>
                    <TableCell>{h.note ?? "—"}</TableCell>
                    <TableCell>
                      {h.createdAt ? new Date(h.createdAt).toLocaleString("tr-TR") : "—"}
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
