"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { requirePortalSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import { DoctorAppShell } from "@/components/DoctorAppShell";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { ListLinkCard } from "@/components/AppShellLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { FormAlert } from "@/components/FormField";
import { applicationDisplayNumber } from "@/lib/application";

type ApplicationItem = {
  applicationId: string;
  applicationNumber?: string;
  statusCode: number;
  ecommerceNumber?: string;
  professionName?: string;
  createdAt: string;
};

export default function NurseQueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = requirePortalSession("doctor");
    if (!session) {
      router.replace(ROUTES.doctor.login);
      return;
    }
    api<{ items: ApplicationItem[] }>(
      API.applications.nurseQueue,
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
    <DoctorAppShell
      title="Sekreterya kuyruğu"
      description="Ödeme alınmış, sekreterya incelemesi bekleyen başvurular"
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading ? (
        <LoadingCards />
      ) : items.length === 0 ? (
        <EmptyState
          title="Kuyrukta başvuru yok"
          description="Ödeme tamamlanan başvurular burada listelenir."
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.applicationId}>
              <ListLinkCard
                href={ROUTES.doctor.application(item.applicationId)}
                title={item.professionName ?? "Başvuru"}
                subtitle={`Başvuru no: ${applicationDisplayNumber(item)}${
                  item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString("tr-TR")}` : ""
                }`}
                badge={<StatusBadge code={item.statusCode} />}
              />
            </li>
          ))}
        </ul>
      )}
    </DoctorAppShell>
  );
}
