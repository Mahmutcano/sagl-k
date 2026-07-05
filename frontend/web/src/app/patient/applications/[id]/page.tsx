"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { PatientAppShell } from "@/components/PatientAppShell";
import { PatientApplicationDetail } from "@/components/ApplicationDetail";

export default function ApplicationDetailPage({ params }: { params: { id: string } }) {
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
      <PatientApplicationDetail id={params.id} token={token} />
    </PatientAppShell>
  );
}
