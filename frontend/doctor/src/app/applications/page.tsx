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

type ApplicationItem = {
  applicationId: string;
  statusCode: number;
  ecommerceNumber?: string;
  professionName?: string;
  createdAt: string;
};

export default function ApplicationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = requirePortalSession("patient");
    if (!session) {
      router.replace("/login");
      return;
    }
    api<{ items: ApplicationItem[] }>(
      API.applications.mine,
      { method: "POST", body: JSON.stringify({ page: 0, pageSize: 20 }) },
      session.token
    )
      .then((res) => setItems(res.items ?? []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Başvurular yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <AppShell
      title="Hasta alanı"
      description="Başvurularınızı görüntüleyin ve yeni başvuru oluşturun"
      actions={
        <Link href="/applications/new" className="btn" data-size="sm">
          Yeni başvuru
        </Link>
      }
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" data-size="sm">
              <section className="space-y-2">
                <div className="skeleton h-5 w-1/3" />
                <div className="skeleton h-4 w-1/2" />
              </section>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty py-10">
            <header>
              <h2>Henüz başvuru yok</h2>
              <p>
                Yeni bir tıbbi danışmanlık başvurusu oluşturduğunuzda burada listelenir.
              </p>
            </header>
            <footer>
              <Link href="/applications/new" className="btn" data-size="sm">
                Yeni başvuru oluştur
              </Link>
            </footer>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.applicationId}>
              <Link
                href={`/applications/${item.applicationId}`}
                className="card block text-left transition hover:ring-2 hover:ring-ring"
                data-size="sm"
              >
                <header>
                  <h3>{item.professionName ?? "Başvuru"}</h3>
                  <p>
                    {item.ecommerceNumber ?? "Numara yok"}
                    {item.createdAt
                      ? ` · ${new Date(item.createdAt).toLocaleDateString("tr-TR")}`
                      : ""}
                  </p>
                  <div className="card-action">
                    <span className="badge" data-variant={statusVariant(item.statusCode)}>
                      {STATUS_LABELS[item.statusCode] ?? `Durum ${item.statusCode}`}
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
