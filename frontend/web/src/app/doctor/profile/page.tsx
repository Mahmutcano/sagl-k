"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoctorAppShell } from "@/components/DoctorAppShell";
import { ProfileSettings } from "@/components/ProfileSettings";
import { requireSession } from "@/lib/auth";

export default function DoctorProfilePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!requireSession("doctor")) {
      router.push("/doctor/login");
    } else {
      setAuthChecked(true);
    }
  }, [router]);

  if (!authChecked) return null;

  return (
    <DoctorAppShell title="Profil Ayarlarım" description="Kişisel tercihlerinizi ve hekim profili bilgilerinizi güncelleyin.">
      <ProfileSettings />
    </DoctorAppShell>
  );
}
