"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { requirePortalSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import { STATUS_LABELS, statusVariant } from "@/lib/application";
import { AppShell } from "@/components/AppShell";
import { FormAlert } from "@/components/FormField";

type Item = {
  applicationId: string;
  statusCode: number;
  ecommerceNumber?: string;
  professionName?: string;
  createdAt: string;
};

export default function NurseQueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = requirePortalSession("doctor");
    if (!session) {
      router.replace("/login");
      return;
    }
    api<{ items: Item[] }>(
      API.applications.nurseQueue,
      { method: "POST", body: JSON.stringify({ page: 0, pageSize: 50 }) },
      session.token
    )
      .then((res) => setItems(res.items ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Kuyruk yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <AppShell
      title="Hemşire kuyruğu"
      description="Sekreterya incelemesi bekleyen başvurular"
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {loading ? (
        <div className="skeleton h-24 w-full" />
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty py-8">
            <header>
              <h3>Kuyruk boş</h3>
              <p>İncelenecek başvuru bulunmuyor.</p>
            </header>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.applicationId}>
              <Link
                href={`/applications/${item.applicationId}`}
                className="card block transition hover:ring-2 hover:ring-ring"
                data-size="sm"
              >
                <header>
                  <h3>{item.professionName ?? "Başvuru"}</h3>
                  <p>{item.ecommerceNumber ?? "—"}</p>
                  <div className="card-action">
                    <span className="badge" data-variant={statusVariant(item.statusCode)}>
                      {STATUS_LABELS[item.statusCode] ?? item.statusCode}
                    </span>
                  </div>
                </header>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
