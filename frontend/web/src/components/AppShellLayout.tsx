"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/utils";
import { LogOut, ArrowRight, Menu } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon?: LucideIcon;
  isActive?: (pathname: string) => boolean;
};

type AppShellLayoutProps = {
  children: React.ReactNode;
  homeHref: string;
  navItems: NavItem[];
  roleBadge?: string;
  onLogout: () => void | Promise<void>;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

export function AppShellLayout({
  children,
  homeHref,
  navItems,
  roleBadge,
  onLogout,
  title,
  description,
  actions,
}: AppShellLayoutProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  function isItemActive(item: NavItem) {
    return item.isActive ? item.isActive(pathname ?? "") : pathname === item.href;
  }

  return (
    <div className="app-shell flex min-h-svh flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              aria-label="Menüyü aç"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <AppLogo href={homeHref} showText={false} className="md:hidden" />
            <AppLogo href={homeHref} className="hidden md:flex" />
            <Separator orientation="vertical" className="hidden h-6 md:block" />
            <nav className="hidden flex-wrap items-center gap-0.5 md:flex">
              {navItems.map((item) => {
                const active = isItemActive(item);
                return (
                  <Button key={item.href} variant={active ? "secondary" : "ghost"} size="sm" asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                );
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {roleBadge ? (
              <Badge variant="outline" className="hidden text-xs sm:inline-flex">
                {roleBadge}
              </Badge>
            ) : null}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setLogoutOpen(true)}
              className="hidden gap-1.5 sm:inline-flex"
            >
              <LogOut className="h-4 w-4" />
              Çıkış
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLogoutOpen(true)}
              className="shrink-0 text-destructive hover:text-destructive sm:hidden"
              aria-label="Çıkış yap"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-[min(85vw,18rem)] flex-col p-0 sm:max-w-xs">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="sr-only">Menü</SheetTitle>
            <AppLogo href={homeHref} showText />
          </SheetHeader>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  variant={active ? "secondary" : "ghost"}
                  className="h-auto justify-start gap-3 px-3 py-3"
                  asChild
                >
                  <Link href={item.href} onClick={() => setMenuOpen(false)}>
                    {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
          {roleBadge ? (
            <div className="border-t px-4 py-3">
              <Badge variant="outline">{roleBadge}</Badge>
            </div>
          ) : null}
          <div className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            <Button variant="destructive" className="w-full gap-2" onClick={() => setLogoutOpen(true)}>
              <LogOut className="h-4 w-4" />
              Çıkış yap
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-8">
        {(title || actions) && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-1">
              {title ? (
                <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                  {title}
                </h1>
              ) : null}
              {description ? (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="mobile-action-row flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        )}
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Ana menü"
      >
        <div className="mx-auto flex max-w-5xl">
          {navItems.map((item) => {
            const active = isItemActive(item);
            const Icon = item.icon;
            const tabLabel = item.shortLabel ?? item.label.split(" ")[0];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors touch-manipulation",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {Icon ? (
                  <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.5px]")} aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                      active ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    {tabLabel.slice(0, 1)}
                  </span>
                )}
                <span className="max-w-full truncate px-0.5">{tabLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <ConfirmModal
        isOpen={logoutOpen}
        title="Çıkış yap"
        message="Oturumu kapatmak istediğinize emin misiniz?"
        confirmText="Evet, çıkış yap"
        cancelText="Vazgeç"
        variant="destructive"
        onConfirm={() => {
          setLogoutOpen(false);
          void onLogout();
        }}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
}

/** Interactive list row card for application queues */
export function ListLinkCard({
  href,
  title,
  subtitle,
  badge,
  className,
}: {
  href: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("group block touch-manipulation", className)}>
      <Card className="transition-colors sm:hover:bg-accent/40">
        <CardContent className="flex items-start justify-between gap-3 p-3 sm:gap-4 sm:p-5">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="break-words font-semibold leading-tight group-hover:text-primary">{title}</p>
            {subtitle ? (
              <p className="break-words text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {badge}
            <ArrowRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
