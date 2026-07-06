"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PatientAppShell } from "@/components/PatientAppShell";
import { ProfileSettings } from "@/components/ProfileSettings";
import { requireSession } from "@/lib/auth";

export default function PatientProfilePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!requireSession("patient")) {
      router.push("/patient/login");
    } else {
      setAuthChecked(true);
    }
  }, [router]);

  if (!authChecked) return null;

  return (
    <PatientAppShell title="Profil Ayarlarım" description="Kişisel tercihlerinizi ve iletişim bilgilerinizi güncelleyin.">
      <ProfileSettings />
    </PatientAppShell>
  );
}
