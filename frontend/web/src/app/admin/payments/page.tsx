"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState } from "react";
import Link from "next/link";
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

type Payment = {
  id: string;
  applicationId: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  createdAt?: string;
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
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
    api<Payment[]>(API.admin.payments, {}, token)
      .then((rows) => setPayments(rows ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Ödemeler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <AdminAppShell title="Ödemeler" description="Son ödeme kayıtları">
      {error ? <FormAlert title="Hata" message={error} /> : null}

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
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başvuru</TableHead>
                  <TableHead>Sağlayıcı</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={ROUTES.admin.application(p.applicationId)}
                        className="underline-offset-4 hover:underline"
                      >
                        {p.applicationId.slice(0, 8)}…
                      </Link>
                    </TableCell>
                    <TableCell>{p.provider}</TableCell>
                    <TableCell>
                      {p.amount.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {p.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.createdAt ? new Date(p.createdAt).toLocaleString("tr-TR") : "—"}
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
