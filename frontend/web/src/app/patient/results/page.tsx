"use client";

import { ROUTES } from "@/lib/routes";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import { PatientAppShell } from "@/components/PatientAppShell";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { FormAlert } from "@/components/FormField";
import {
  PatientApplicationRow,
  type ApplicationListItem,
} from "@/components/PatientApplicationList";

export default function ResultsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApplicationListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const session = requireSession("patient");
    if (!session) {
      router.replace(ROUTES.patient.login);
      return Promise.resolve();
    }
    setLoading(true);
    return api<{ items: ApplicationListItem[] }>(
      API.applications.mine,
      { method: "POST", body: JSON.stringify({ page: 0, pageSize: 50 }) },
      session.token
    )
      .then((res) => {
        // Filter to only include concluded/completed applications (status code 6)
        const completed = (res.items ?? []).filter((x) => x.statusCode === 6);
        setItems(completed);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Sonuçlar yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PatientAppShell
      title="Sonuçlarım"
      description="Doktor değerlendirmesi tamamlanmış ve resmi hekim raporu hazırlanmış tıbbi danışmanlık başvurularınız."
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading ? (
        <LoadingCards />
      ) : items.length === 0 ? (
        <EmptyState
          title="Henüz sonuçlanmış başvurunuz yok"
          description="Başvurunuz hekim tarafından değerlendirilip sonuç raporu hazırlandığında burada listelenecektir."
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="divide-y">
            {items.map((item) => (
              <PatientApplicationRow
                key={item.applicationId}
                item={item}
                deleting={false}
                onDelete={() => {}}
              />
            ))}
          </div>
        </div>
      )}
    </PatientAppShell>
  );
}
