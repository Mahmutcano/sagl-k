"use client";

import { useRouter } from "next/navigation";
import { AppShellLayout } from "@/components/AppShellLayout";
import { isNurseRole, logoutTo, roleLabel } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getUser } from "@/lib/api";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

export function DoctorAppShell({ children, title, description, actions }: AppShellProps) {
  const router = useRouter();
  const user = getUser();
  const nurse = isNurseRole(user?.role);

  const navItems = nurse
    ? [
        {
          href: ROUTES.doctor.nurse,
          label: "Sekreterya kuyruğu",
          isActive: (p: string) =>
            p === "/doctor/nurse" ||
            (p.startsWith("/doctor/applications/") && p !== "/doctor/applications"),
        },
      ]
    : [
        {
          href: ROUTES.doctor.dashboard,
          label: "Başvurularım",
          isActive: (p: string) =>
            p === "/doctor/dashboard" ||
            (p.startsWith("/doctor/applications/") && p !== "/doctor/applications"),
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
