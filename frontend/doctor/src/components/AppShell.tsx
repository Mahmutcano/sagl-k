"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { canAccessPatientArea, isDoctorRole, logoutTo, roleLabel } from "@/lib/auth";
import { PATIENT_APP_URL } from "@/lib/urls";
import { getUser } from "@/lib/api";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

export function AppShell({ children, title, description, actions }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = getUser();
  const role = user?.role;

  return (
    <div className="min-h-svh flex flex-col bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Link href="/dashboard" className="btn" data-variant="ghost" data-size="sm">
              <span className="font-semibold tracking-tight">Tıbbi Danışmanlık</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-1">
              <Link
                href="/dashboard"
                className="btn"
                data-variant={pathname === "/dashboard" ? "secondary" : "ghost"}
                data-size="sm"
              >
                Doktor
              </Link>
              {canAccessPatientArea(role) ? (
                <Link
                  href="/applications"
                  className="btn"
                  data-variant={pathname?.startsWith("/applications") ? "secondary" : "ghost"}
                  data-size="sm"
                >
                  Hasta alanı
                </Link>
              ) : null}
              <Link
                href="/nurse"
                className="btn"
                data-variant={pathname === "/nurse" ? "secondary" : "ghost"}
                data-size="sm"
              >
                Hemşire
              </Link>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {role ? (
              <span className="badge" data-variant="outline">
                {roleLabel(role)}
                {isDoctorRole(role) && pathname?.startsWith("/applications") ? " · hasta alanı" : ""}
              </span>
            ) : null}
            <a href={PATIENT_APP_URL} className="btn" data-variant="ghost" data-size="sm">
              Hasta portalı
            </a>
            <button
              type="button"
              className="btn"
              data-variant="outline"
              data-size="sm"
              onClick={() => router.push(logoutTo())}
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {(title || actions) && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              {title ? <h1 className="text-2xl font-semibold tracking-tight">{title}</h1> : null}
              {description ? (
                <p className="text-muted-foreground text-sm">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
