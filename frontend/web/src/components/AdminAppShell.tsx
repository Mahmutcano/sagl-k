"use client";

import { useRouter } from "next/navigation";
import { AppShellLayout } from "@/components/AppShellLayout";
import { AdminNav } from "@/components/AdminNav";
import { logoutTo, roleLabel } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getUser } from "@/lib/api";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

export function AdminAppShell({ children, title, description, actions }: AppShellProps) {
  const router = useRouter();
  const user = getUser();

  return (
    <AppShellLayout
      homeHref={ROUTES.admin.home}
      navItems={[]}
      roleBadge={user?.role ? `${roleLabel(user.role)} · Yönetim` : "Yönetim"}
      onLogout={() => router.push(logoutTo("admin"))}
      title={title}
      description={description}
      actions={actions}
    >
      <AdminNav />
      {children}
    </AppShellLayout>
  );
}
