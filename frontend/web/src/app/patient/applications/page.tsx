"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import { PatientAppShell } from "@/components/PatientAppShell";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { ListLinkCard } from "@/components/AppShellLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { FormAlert } from "@/components/FormField";
import { applicationDisplayNumber } from "@/lib/application";
import { Button } from "@/components/ui/button";

type ApplicationItem = {
  applicationId: string;
  applicationNumber?: string;
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
    const session = requireSession("patient");
    if (!session) {
      router.replace(ROUTES.patient.login);
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
    <PatientAppShell
      title="Hasta alanı"
      description="Başvurularınızı görüntüleyin ve yeni başvuru oluşturun"
      actions={
        <Button size="sm" asChild>
          <Link href={ROUTES.patient.newApplication}>Yeni başvuru</Link>
        </Button>
      }
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading ? (
        <LoadingCards />
      ) : items.length === 0 ? (
        <EmptyState
          title="Henüz başvuru yok"
          description="Yeni bir tıbbi danışmanlık başvurusu oluşturduğunuzda burada listelenir."
          action={
            <Button size="sm" asChild>
              <Link href={ROUTES.patient.newApplication}>Yeni başvuru oluştur</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.applicationId}>
              <ListLinkCard
                href={ROUTES.patient.application(item.applicationId)}
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
    </PatientAppShell>
  );
}
