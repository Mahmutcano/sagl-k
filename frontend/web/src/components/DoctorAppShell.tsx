"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, UserCircle, Stethoscope } from "lucide-react";
import { AppShellLayout } from "@/components/AppShellLayout";
import { useClientUser } from "@/hooks/useClientUser";
import { isNurseRole, logoutTo, roleLabel } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

export function DoctorAppShell({ children, title, description, actions }: AppShellProps) {
  const router = useRouter();
  const user = useClientUser();
  const nurse = isNurseRole(user?.role);

  const navItems = nurse
    ? [
        {
          href: ROUTES.doctor.nurse,
          label: "Sekreterya kuyruğu",
          shortLabel: "Kuyruk",
          icon: ClipboardList,
          isActive: (p: string) =>
            p === "/doctor/nurse" ||
            (p.startsWith("/doctor/applications/") &&
              p !== "/doctor/applications" &&
              !p.endsWith("/profile")),
        },
        {
          href: ROUTES.doctor.profile,
          label: "Profil Ayarlarım",
          shortLabel: "Profil",
          icon: UserCircle,
          isActive: (p: string) => p.startsWith("/doctor/profile"),
        },
      ]
    : [
        {
          href: ROUTES.doctor.dashboard,
          label: "Başvurularım",
          shortLabel: "Başvurular",
          icon: Stethoscope,
          isActive: (p: string) =>
            p === "/doctor/dashboard" ||
            (p.startsWith("/doctor/applications/") &&
              p !== "/doctor/applications" &&
              !p.endsWith("/profile")),
        },
        {
          href: ROUTES.doctor.stats,
          label: "Özet panel",
          shortLabel: "Özet",
          icon: ClipboardList,
          isActive: (p: string) => p.startsWith("/doctor/stats"),
        },
        {
          href: ROUTES.doctor.profile,
          label: "Profil Ayarlarım",
          shortLabel: "Profil",
          icon: UserCircle,
          isActive: (p: string) => p.startsWith("/doctor/profile"),
        },
      ];

  return (
    <AppShellLayout
      homeHref={nurse ? ROUTES.doctor.nurse : ROUTES.doctor.dashboard}
      navItems={navItems}
      roleBadge={user?.role ? roleLabel(user.role) : undefined}
      onLogout={() => router.push(logoutTo("doctor"))}
      title={title}
      description={description}
      actions={actions}
    >
      {children}
    </AppShellLayout>
  );
}
