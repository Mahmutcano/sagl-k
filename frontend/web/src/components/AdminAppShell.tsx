"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClientUser } from "@/hooks/useClientUser";
import { logoutTo, roleLabel } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
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
  HeartPulse,
  Tag,
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

  function handleLogout() {
    router.push(logoutTo("admin"));
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 text-slate-700">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-slate-200 bg-slate-50/50">
        <HeartPulse className="h-6 w-6 text-primary" />
        <div>
          <span className="font-bold text-sm block tracking-wide text-slate-900">Tıbbi Danışmanlık</span>
        </div>
      </div>

      {/* Nav Navigation List */}
      <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
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
                  "h-4 w-4 transition-colors",
                  active ? "text-primary-foreground" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Profile/Footer Panel */}
      <div className="border-t border-slate-200 p-4 bg-slate-50/50">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 border font-bold text-xs">
            {user?.role ? roleLabel(user.role).slice(0, 2).toUpperCase() : "AD"}
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-bold truncate text-slate-800 uppercase">
              {user?.role ? roleLabel(user.role) : "Yönetici"}
            </span>
            <span className="block text-[10px] text-slate-500 truncate">
              {user?.id ? `ID: ${user.id.slice(0, 8)}` : "Sistem Yetkilisi"}
            </span>
          </div>
        </div>
        <Button
          onClick={handleLogout}
          variant="destructive"
          size="sm"
          className="w-full justify-center gap-1.5 h-8 text-xs font-semibold"
        >
          <LogOut className="h-3.5 w-3.5" />
          Çıkış Yap
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50/50">
      {/* Desktop Sidebar (Left-hand persistent) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar (Left-hand sliding Drawer) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-55 w-64 flex flex-col md:hidden transition-transform duration-300 ease-in-out transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="p-1 md:hidden text-slate-600 hover:text-slate-900"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            
            {title ? (
              <h2 className="text-sm font-bold tracking-tight text-slate-800 hidden sm:block">
                {title}
              </h2>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {user?.role && (
              <Badge variant="outline" className="text-[10px] py-0.5 px-2 bg-slate-50 border-slate-300 text-slate-600">
                {roleLabel(user.role)}
              </Badge>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 border font-bold text-xs select-none">
              A
            </div>
          </div>
        </header>

        {/* Content Body Area */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto flex flex-col gap-6">
          {(title || actions) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200">
              <div className="space-y-1">
                {title ? (
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-800">
                    {title}
                  </h1>
                ) : null}
                {description ? (
                  <p className="text-slate-500 text-xs md:text-sm max-w-2xl">{description}</p>
                ) : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
            </div>
          )}
          
          <div className="flex-1 flex flex-col gap-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
