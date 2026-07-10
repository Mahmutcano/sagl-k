"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClientUser } from "@/hooks/useClientUser";
import { logoutTo, roleLabel, userDisplayName } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { api, getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Building2,
  Users,
  CreditCard,
  RefreshCw,
  Bell,
  UserSquare2,
  Activity,
  LogOut,
  Menu,
  Layers,
  Tag,
  X,
} from "lucide-react";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

export function AdminAppShell({ children, title, description, actions }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useClientUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api<{ firstName?: string; lastName?: string }>("/api/v1/profile", {}, token)
      .then((p) => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
        if (name) setDisplayName(name);
      })
      .catch(() => {});
  }, []);

  const sidebarName = displayName || userDisplayName(user) || "Yönetici";

  const navItems = [
    { href: ROUTES.admin.home, label: "Başvurular", icon: Home, exact: true },
    { href: ROUTES.admin.hospitals, label: "Hastaneler", icon: Building2 },
    { href: ROUTES.admin.departments, label: "Bölümler / Branşlar", icon: Layers },
    { href: ROUTES.admin.doctors, label: "Doktorlar", icon: Users },
    { href: ROUTES.admin.titles, label: "Unvan Tanımları", icon: Tag },
    { href: ROUTES.admin.payments, label: "Ödemeler & Faturalar", icon: CreditCard },
    { href: ROUTES.admin.refunds, label: "İade Talepleri", icon: RefreshCw },
    { href: ROUTES.admin.users, label: "Kullanıcılar", icon: UserSquare2 },
    { href: ROUTES.admin.notifications, label: "Bildirim Takibi", icon: Bell },
    { href: ROUTES.admin.logs, label: "Sistem Logları", icon: Activity },
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  function handleLogout() {
    router.push(logoutTo("admin"));
  }

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-white border-r border-slate-200 text-slate-700">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4 border-b border-slate-200 bg-slate-50/50 sm:h-16 sm:px-5">
        <AppLogo href={ROUTES.admin.home} showText className="min-w-0" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 md:hidden"
          aria-label="Menüyü kapat"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold tracking-wide transition-all duration-150",
                active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-primary-foreground" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3 bg-slate-50/50 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Link
          href={ROUTES.admin.profile}
          onClick={() => setMobileOpen(false)}
          className="mb-3 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-100"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-primary/10 text-xs font-bold text-primary">
            {sidebarName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-800">
              {sidebarName}
            </span>
            <span className="block truncate text-[11px] text-slate-500">
              {user?.role ? roleLabel(user.role) : "Profil ayarları"}
            </span>
          </div>
        </Link>
        <Button
          onClick={handleLogout}
          variant="destructive"
          size="sm"
          className="h-9 w-full justify-center gap-1.5 text-xs font-semibold"
        >
          <LogOut className="h-3.5 w-3.5" />
          Çıkış Yap
        </Button>
      </div>
    </div>
  );

  return (
    <div className="admin-shell flex min-h-svh min-w-0 overflow-x-hidden bg-slate-50/50">
      <aside className="z-40 hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex w-[min(18rem,88vw)] flex-col shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          "pt-[env(safe-area-inset-top,0px)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 shadow-sm sm:px-4 md:px-6 pt-[env(safe-area-inset-top,0px)]">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-slate-600 hover:text-slate-900 md:hidden"
              aria-label="Menüyü aç"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            {title ? (
              <h2 className="truncate text-sm font-bold tracking-tight text-slate-800">
                {title}
              </h2>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {user?.role ? (
              <Badge
                variant="outline"
                className="hidden border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 sm:inline-flex"
              >
                {roleLabel(user.role)}
              </Badge>
            ) : null}
            <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-slate-100 text-xs font-bold text-slate-700 select-none">
              A
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5 md:gap-6 md:px-6 md:py-8 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          {(title || description || actions) && (
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-start sm:justify-between sm:pb-4">
              <div className="min-w-0 space-y-1">
                {title ? (
                  <h1 className="hidden text-xl font-bold tracking-tight text-slate-800 sm:block md:text-2xl">
                    {title}
                  </h1>
                ) : null}
                {description ? (
                  <p className="max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm">
                    {description}
                  </p>
                ) : null}
              </div>
              {actions ? (
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                  {actions}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
