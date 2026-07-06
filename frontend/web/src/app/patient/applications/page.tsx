"use client";

import { ROUTES } from "@/lib/routes";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import { PatientAppShell } from "@/components/PatientAppShell";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { FormAlert } from "@/components/FormField";
import {
  ApplicationListGroup,
  PatientApplicationRow,
  type ApplicationListItem,
} from "@/components/PatientApplicationList";
import { groupPatientApplications } from "@/lib/application";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export default function ApplicationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApplicationListItem[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

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
      .then((res) => setItems(res.items ?? []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Başvurular yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function deleteApplication(id: string) {
    setDeleteTargetId(id);
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    const token = getToken();
    if (!token) return;
    setDeletingId(id);
    setError("");
    setMsg("");
    try {
      await api(API.applications.cancel(id), { method: "DELETE" }, token);
      setItems((prev) => prev.filter((x) => x.applicationId !== id));
      setMsg("Başvuru silindi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Başvuru silinemedi.");
    } finally {
      setDeletingId("");
    }
  }

  const grouped = groupPatientApplications(items);

  return (
    <PatientAppShell
      title="Başvurularım"
      description="Başvurularınız duruma göre gruplanır. Ödeme bekleyenlerde kaldığınız adımdan devam edebilirsiniz."
      actions={
        <Button size="sm" asChild>
          <Link href={ROUTES.patient.newApplication}>Yeni başvuru</Link>
        </Button>
      }
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Bilgi" message={msg} variant="default" /> : null}

      {loading ? (
        <LoadingCards />
      ) : items.length === 0 ? (
        <EmptyState
          title="Henüz başvuru yok"
          description="Yeni başvuru: Bölüm → Şikayet → Önizleme → Ödeme adımlarıyla ilerler."
          action={
            <Button size="sm" asChild>
              <Link href={ROUTES.patient.newApplication}>Yeni başvuru oluştur</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8">
          {grouped.map(({ group, items: groupItems }) => (
            <ApplicationListGroup
              key={group.id}
              title={group.title}
              description={group.description}
              stepHint={group.stepHint}
            >
              {groupItems.map((item) => (
                <li key={item.applicationId}>
                  <PatientApplicationRow
                    item={item}
                    onDelete={deleteApplication}
                    deleting={deletingId === item.applicationId}
                  />
                </li>
              ))}
            </ApplicationListGroup>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title="Başvuruyu Sil"
        message="Bu başvuru kalıcı olarak silinecek. Yalnızca ödeme yapılmamış taslaklar silinebilir. Devam edilsin mi?"
        confirmText="Evet, Sil"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </PatientAppShell>
  );
}
