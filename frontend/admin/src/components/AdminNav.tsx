"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Özet" },
  { href: "/doctors", label: "Doktorlar" },
  { href: "/payments", label: "Ödemeler" },
  { href: "/refunds", label: "İadeler" },
  { href: "/notifications", label: "Bildirimler" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-3 mb-2">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="btn"
          data-variant={pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href)) ? "secondary" : "ghost"}
          data-size="sm"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
