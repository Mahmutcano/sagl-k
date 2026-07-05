"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requirePortalSession } from "@/lib/auth";
import { DoctorAppShell } from "@/components/DoctorAppShell";
import { StaffApplicationDetail } from "@/components/StaffApplicationDetail";

export default function StaffApplicationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const session = requirePortalSession("doctor");
    if (!session) {
      router.replace(ROUTES.doctor.login);
      return;
    }
    setToken(session.token);
  }, [router]);

  if (!token) return null;

  return (
    <DoctorAppShell title="Başvuru detayı" description="Değerlendirme, rapor ve notlar">
      <StaffApplicationDetail id={params.id} token={token} />
    </DoctorAppShell>
  );
}
