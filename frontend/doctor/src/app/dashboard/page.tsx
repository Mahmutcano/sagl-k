"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { requirePortalSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import { AppShell } from "@/components/AppShell";
import { FormAlert } from "@/components/FormField";

type ApplicationItem = {
  applicationId: string;
  statusCode: number;
  ecommerceNumber?: string;
  professionName?: string;
  createdAt: string;
};

import { STATUS_LABELS, statusVariant } from "@/lib/application";

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = requirePortalSession("doctor");
    if (!session) {
      router.replace("/login");
      return;
    }
    api<{ items: ApplicationItem[] }>(
      API.applications.doctorQueue,
      { method: "POST", body: JSON.stringify({ page: 0, pageSize: 50 }) },
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
      title="Doktor paneli"
      description="Değerlendirme kuyruğu — hasta alanına üst menüden geçebilirsiniz"
      actions={
        <Link href="/applications" className="btn" data-variant="outline" data-size="sm">
          Hasta alanına geç
        </Link>
      }
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" data-size="sm">
              <section>
                <div className="skeleton h-5 w-1/3" />
              </section>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty py-10">
            <header>
              <h2>Kuyrukta başvuru yok</h2>
              <p>Size atanan veya doktor incelemesi bekleyen başvurular burada listelenir.</p>
            </header>
            <footer>
              <Link href="/applications" className="btn" data-variant="secondary">
                Hasta alanına git
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
                className="card block transition hover:ring-2 hover:ring-ring"
                data-size="sm"
              >
                <header>
                  <h3>{item.professionName ?? "Başvuru"}</h3>
                  <p>
                    {item.ecommerceNumber ?? "—"}
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
