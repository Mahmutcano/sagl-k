"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, getToken, getUser, isAdminRole } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/AdminNav";
import { FormAlert } from "@/components/FormField";

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
      router.replace("/login");
      return;
    }
    api<NotificationLog[]>(API.admin.notifications, {}, token)
      .then((rows) => setItems(rows ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Kayıtlar yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <AppShell title="Bildirimler" description="SMS ve e-posta gönderim günlüğü">
      <AdminNav />
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading ? (
        <div className="skeleton h-40 w-full" />
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty py-10">
            <header>
              <h2>Kayıt yok</h2>
              <p>Gönderilen bildirimler burada listelenir.</p>
            </header>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Kanal</th>
                <th>Alıcı</th>
                <th>Şablon</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id}>
                  <td>
                    <span className="badge" data-variant="outline">
                      {n.channel}
                    </span>
                  </td>
                  <td>{n.recipient}</td>
                  <td>{n.templateKey}</td>
                  <td>
                    <span className="badge" data-variant="secondary">
                      {n.status}
                    </span>
                  </td>
                  <td>
                    {n.createdAt ? new Date(n.createdAt).toLocaleString("tr-TR") : "—"}
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
