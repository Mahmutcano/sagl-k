"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LogOut, ArrowRight } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
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

  return (
    <div className="app-shell min-h-svh flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <AppLogo href={homeHref} showText={false} className="sm:hidden" />
            <AppLogo href={homeHref} className="hidden sm:flex" />
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <nav className="flex flex-wrap items-center gap-0.5">
              {navItems.map((item) => {
                const active = item.isActive
                  ? item.isActive(pathname ?? "")
                  : pathname === item.href;
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
              <Badge variant="outline" className="hidden sm:inline-flex">
                {roleBadge}
              </Badge>
            ) : null}
            <Button variant="destructive" size="sm" onClick={() => void onLogout()} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {(title || actions) && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              {title ? <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1> : null}
              {description ? <p className="text-muted-foreground max-w-2xl text-sm">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        )}
        {children}
      </main>
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
    <Link href={href} className={cn("group block", className)}>
      <div className="interactive-card rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="font-semibold leading-tight group-hover:text-primary">{title}</p>
            {subtitle ? <p className="text-muted-foreground text-sm">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </div>
      </div>
    </Link>
  );
}
