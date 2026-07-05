"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/AdminNav";
import { FormAlert } from "@/components/FormField";

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
      router.replace("/login");
      return;
    }
    api<Payment[]>(API.admin.payments, {}, token)
      .then((rows) => setPayments(rows ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Ödemeler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <AppShell title="Ödemeler" description="Son ödeme kayıtları">
      <AdminNav />
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading ? (
        <div className="skeleton h-40 w-full" />
      ) : payments.length === 0 ? (
        <div className="card">
          <div className="empty py-10">
            <header>
              <h2>Ödeme kaydı yok</h2>
              <p>Hasta ödemeleri burada listelenir.</p>
            </header>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Başvuru</th>
                <th>Sağlayıcı</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/applications/${p.applicationId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {p.applicationId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td>{p.provider}</td>
                  <td>
                    {p.amount.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {p.currency}
                  </td>
                  <td>
                    <span className="badge" data-variant="secondary">
                      {p.status}
                    </span>
                  </td>
                  <td>
                    {p.createdAt ? new Date(p.createdAt).toLocaleString("tr-TR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
