"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { requireSession } from "@/lib/auth";
import { PatientAppShell } from "@/components/PatientAppShell";
import { PatientApplicationDetail } from "@/components/ApplicationDetail";

function ApplicationDetailBody({ id }: { id: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const session = requireSession("patient");
    if (!session) {
      router.replace(ROUTES.patient.login);
      return;
    }
    setToken(session.token);
  }, [router]);

  if (!token) return null;

  return (
    <PatientAppShell title="Başvuru detayı" description="Durum, ödeme ve notlar">
      <PatientApplicationDetail id={id} token={token} />
    </PatientAppShell>
  );
}

export default function ApplicationDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>}>
      <ApplicationDetailBody id={params.id} />
    </Suspense>
  );
}
