import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  children: React.ReactNode;
  badge?: string;
  /** Wider content column for multi-field forms (e.g. register). */
  wide?: boolean;
};

export function AuthShell({ children, badge = "Hasta", wide = false }: AuthShellProps) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-x-hidden bg-background text-foreground pb-[env(safe-area-inset-bottom,0px)]">
      <div className="pointer-events-none absolute -right-40 -top-40 size-[500px] rounded-full bg-primary/8 opacity-70 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 size-[500px] rounded-full bg-primary/5 opacity-60 blur-[120px]" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-6 sm:py-5">
        <AppLogo href="/" showText={false} className="sm:hidden" />
        <AppLogo href="/" className="hidden sm:flex" />
        <Badge
          variant="outline"
          className="shrink-0 border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary backdrop-blur-sm sm:px-3 sm:text-xs"
        >
          {badge} Portalı
        </Badge>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-8">
        <div className={cn("mx-auto w-full space-y-6", wide ? "max-w-2xl" : "max-w-md")}>
          {children}
        </div>
      </main>

      <footer className="relative z-10 mx-auto hidden w-full max-w-5xl items-center justify-center border-t border-slate-200/40 px-6 py-5 text-xs text-muted-foreground sm:flex">
        <p>© {new Date().getFullYear()} Erciyes Üniversitesi Tıp Fakültesi. Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
}
