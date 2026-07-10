"use client";

import { ProfileSettings } from "@/components/ProfileSettings";
import { AdminAppShell } from "@/components/AdminAppShell";

export default function AdminProfilePage() {
  return (
    <AdminAppShell
      title="Profil Ayarları"
      description="Kişisel bilgilerinizi ve şifrenizi güncelleyin."
    >
      <ProfileSettings />
    </AdminAppShell>
  );
}
