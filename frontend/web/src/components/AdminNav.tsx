"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: ROUTES.admin.home, label: "Özet" },
  { href: ROUTES.admin.doctors, label: "Doktorlar" },
  { href: ROUTES.admin.payments, label: "Ödemeler" },
  { href: ROUTES.admin.refunds, label: "İadeler" },
  { href: ROUTES.admin.notifications, label: "Bildirimler" },
  { href: ROUTES.admin.users, label: "Kullanıcılar" },
  { href: ROUTES.admin.logs, label: "Sistem Logları" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1"
      aria-label="Yönetim menüsü"
    >
      {LINKS.map((l) => {
        const active =
          pathname === l.href || (l.href !== ROUTES.admin.home && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
