"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken, getUser, isAdminRole, clearAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { STATUS_LABELS, statusVariant, type StatusHistoryItem } from "@/lib/application";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/AdminNav";
import { FormAlert } from "@/components/FormField";

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
      router.replace("/login");
      return;
    }
    api<StatusHistoryItem[]>(API.admin.applicationHistory(params.id), {}, token)
      .then(setHistory)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Geçmiş yüklenemedi."))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  return (
    <AppShell title="Başvuru geçmişi" description={params.id}>
      <AdminNav />
      <Link href="/" className="btn mb-4" data-variant="ghost" data-size="sm">
        ← Özete dön
      </Link>
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {loading ? (
        <div className="skeleton h-32 w-full" />
      ) : history.length === 0 ? (
        <div className="card">
          <div className="empty py-8">
            <header>
              <h3>Kayıt yok</h3>
              <p>Durum geçmişi bulunamadı.</p>
            </header>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Önceki</th>
                <th>Yeni</th>
                <th>Not</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>
                    {h.oldStatusCode != null
                      ? STATUS_LABELS[h.oldStatusCode] ?? h.oldStatusCode
                      : "—"}
                  </td>
                  <td>
                    <span className="badge" data-variant={statusVariant(h.newStatusCode)}>
                      {STATUS_LABELS[h.newStatusCode] ?? h.newStatusCode}
                    </span>
                  </td>
                  <td>{h.note ?? "—"}</td>
                  <td>
                    {h.createdAt ? new Date(h.createdAt).toLocaleString("tr-TR") : "—"}
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
