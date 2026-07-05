"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requirePortalSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PatientApplicationDetail } from "@/components/ApplicationDetail";

export default function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const session = requirePortalSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setToken(session.token);
  }, [router]);

  if (!token) return null;

  return (
    <AppShell title="Başvuru detayı" description="Durum, ödeme ve notlar">
      <PatientApplicationDetail id={params.id} token={token} />
    </AppShell>
  );
}
