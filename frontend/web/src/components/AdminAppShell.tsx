"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClientUser } from "@/hooks/useClientUser";
import { logoutTo, roleLabel, userDisplayName } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { api, getToken } from "@/lib/api";
import { AppLogo } from "@/components/AppLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  MessageSquare,
  Smartphone,
  Calculator,
  BarChart3,
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
  const [logoutOpen, setLogoutOpen] = useState(false);
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
  const initials = sidebarName.slice(0, 2).toUpperCase();

  const navItems = [
    { href: ROUTES.admin.home, label: "Başvurular", icon: Home, exact: true },
    { href: ROUTES.admin.hospitals, label: "Hastaneler", icon: Building2 },
    { href: ROUTES.admin.departments, label: "Bölümler / Branşlar", icon: Layers },
    { href: ROUTES.admin.doctors, label: "Doktorlar", icon: Users },
    { href: ROUTES.admin.titles, label: "Unvan Tanımları", icon: Tag },
    { href: ROUTES.admin.payments, label: "Ödemeler & Faturalar", icon: CreditCard },
    { href: ROUTES.admin.refunds, label: "İade Talepleri", icon: RefreshCw },
    { href: ROUTES.admin.reports, label: "Rapor Merkezi", icon: BarChart3 },
    { href: ROUTES.admin.accounting, label: "Hesaplar", icon: Calculator },
    { href: ROUTES.admin.users, label: "Kullanıcılar", icon: UserSquare2 },
    { href: ROUTES.admin.contact, label: "İletişim / Öneri", icon: MessageSquare },
    { href: ROUTES.admin.notifications, label: "SMS / E-posta Raporu", icon: Bell },
    { href: ROUTES.admin.smsLogs, label: "SMS Kod Logları", icon: Smartphone },
    { href: ROUTES.admin.logs, label: "Sistem Logları", icon: Activity },
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleLogout() {
    router.push(logoutTo("admin"));
  }

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Button
            key={item.href}
            variant={active ? "secondary" : "ghost"}
            className="h-auto justify-start gap-3 px-3 py-2.5"
            asChild
          >
            <Link href={item.href} onClick={() => setMobileOpen(false)}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          </Button>
        );
      })}
    </nav>
  );

  const sidebarFooter = (
    <div className="shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      <Link
        href={ROUTES.admin.profile}
        onClick={() => setMobileOpen(false)}
        className="mb-3 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
      >
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{sidebarName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user?.role ? roleLabel(user.role) : "Profil ayarları"}
          </span>
        </div>
      </Link>
      <Button onClick={() => setLogoutOpen(true)} variant="destructive" size="sm" className="w-full gap-1.5">
        <LogOut className="h-3.5 w-3.5" />
        Çıkış Yap
      </Button>
    </div>
  );

  return (
    <div className="admin-shell flex min-h-svh min-w-0 overflow-x-hidden bg-muted/40">
      <aside className="z-40 hidden border-r bg-background md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex h-14 shrink-0 items-center px-4 sm:h-16 sm:px-5">
          <AppLogo href={ROUTES.admin.home} showText className="min-w-0" />
        </div>
        <Separator />
        {navLinks}
        {sidebarFooter}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-[min(18rem,88vw)] flex-col p-0 sm:max-w-xs">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="sr-only">Yönetim menüsü</SheetTitle>
            <AppLogo href={ROUTES.admin.home} showText />
          </SheetHeader>
          {navLinks}
          {sidebarFooter}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background px-3 pt-[env(safe-area-inset-top,0px)] sm:px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 md:hidden"
              aria-label="Menüyü aç"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            {title ? (
              <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={ROUTES.admin.profile}
              className="hidden min-w-0 max-w-[14rem] items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent sm:flex"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium leading-tight">{sidebarName}</span>
                {user?.role ? (
                  <span className="block truncate text-xs text-muted-foreground">{roleLabel(user.role)}</span>
                ) : null}
              </div>
            </Link>
            <Avatar className="h-8 w-8 sm:hidden">
              <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5 md:gap-6 md:px-6 md:py-8 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          {(title || description || actions) && (
            <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-start sm:justify-between sm:pb-4">
              <div className="min-w-0 space-y-1">
                {title ? (
                  <h1 className="hidden text-xl font-semibold tracking-tight sm:block md:text-2xl">
                    {title}
                  </h1>
                ) : null}
                {description ? (
                  <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
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
      <ConfirmModal
        isOpen={logoutOpen}
        title="Çıkış yap"
        message="Oturumu kapatmak istediğinize emin misiniz?"
        confirmText="Evet, çıkış yap"
        cancelText="Vazgeç"
        variant="destructive"
        onConfirm={() => {
          setLogoutOpen(false);
          handleLogout();
        }}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
}
