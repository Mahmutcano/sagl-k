"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requirePortalSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { StaffApplicationDetail } from "@/components/ApplicationDetail";

export default function StaffApplicationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const session = requirePortalSession("doctor");
    if (!session) {
      router.replace("/login");
      return;
    }
    setToken(session.token);
  }, [router]);

  if (!token) return null;

  return (
    <AppShell title="Başvuru detayı" description="Değerlendirme, rapor ve notlar">
      <StaffApplicationDetail id={params.id} token={token} />
    </AppShell>
  );
}
