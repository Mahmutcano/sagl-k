import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  children: React.ReactNode;
  badge?: string;
  /** Wider content column for multi-field forms (e.g. register). */
  wide?: boolean;
};

export function AuthShell({ children, badge = "Hasta", wide = false }: AuthShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground pb-[env(safe-area-inset-bottom,0px)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-6 sm:py-5">
        <AppLogo href="/" showText={false} className="sm:hidden" />
        <AppLogo href="/" className="hidden sm:flex" />
        <Badge variant="outline" className="shrink-0">
          {badge} Portalı
        </Badge>
      </header>

      <Separator />

      <main className="flex flex-1 flex-col justify-start px-4 py-6 sm:px-6 sm:py-10">
        <div className={cn("mx-auto w-full space-y-6", wide ? "max-w-2xl" : "max-w-md")}>
          {children}
        </div>
      </main>

      <footer className="mx-auto mt-auto hidden w-full max-w-5xl items-center justify-center border-t px-6 py-5 text-xs text-muted-foreground sm:flex">
        <p>© {new Date().getFullYear()} Erciyes Üniversitesi Tıp Fakültesi. Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
}
