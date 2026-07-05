"use client";

import { useRouter } from "next/navigation";
import { AppShellLayout } from "@/components/AppShellLayout";
import { logoutTo, roleLabel } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getUser } from "@/lib/api";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PatientAppShell({ children, title, description, actions }: AppShellProps) {
  const router = useRouter();
  const user = getUser();

  return (
    <AppShellLayout
      homeHref={ROUTES.patient.applications}
      navItems={[
        {
          href: ROUTES.patient.applications,
          label: "Başvurularım",
          isActive: (p) => p.startsWith("/patient/applications"),
        },
      ]}
      roleBadge={user?.role ? roleLabel(user.role) : undefined}
      onLogout={() => router.push(logoutTo("patient"))}
      title={title}
      description={description}
      actions={actions}
    >
      {children}
    </AppShellLayout>
  );
}
