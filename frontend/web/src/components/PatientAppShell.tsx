"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, FileCheck, UserCircle } from "lucide-react";
import { AppShellLayout } from "@/components/AppShellLayout";
import { useClientUser } from "@/hooks/useClientUser";
import { logoutTo, roleLabel } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PatientAppShell({ children, title, description, actions }: AppShellProps) {
  const router = useRouter();
  const user = useClientUser();

  return (
    <AppShellLayout
      homeHref={ROUTES.patient.applications}
      navItems={[
        {
          href: ROUTES.patient.applications,
          label: "Başvurularım",
          shortLabel: "Başvurular",
          icon: ClipboardList,
          isActive: (p) => p === "/patient/applications" || p.startsWith("/patient/applications/"),
        },
        {
          href: ROUTES.patient.results,
          label: "Sonuçlarım",
          shortLabel: "Sonuçlar",
          icon: FileCheck,
          isActive: (p) => p.startsWith("/patient/results"),
        },
        {
          href: ROUTES.patient.profile,
          label: "Profil Ayarlarım",
          shortLabel: "Profil",
          icon: UserCircle,
          isActive: (p) => p.startsWith("/patient/profile"),
        },
      ]}
      roleBadge={user?.role ? roleLabel(user.role) : "Hasta"}
      profileHref={ROUTES.patient.profile}
      onLogout={() => router.push(logoutTo("patient"))}
      title={title}
      description={description}
      actions={actions}
    >
      {children}
    </AppShellLayout>
  );
}
