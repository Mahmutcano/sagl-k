import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";


type AuthShellProps = {
  children: React.ReactNode;
  badge?: string;
};

export function AuthShell({ children, badge = "Hasta" }: AuthShellProps) {
  return (
    <div className="min-h-svh flex flex-col bg-background text-foreground relative overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
      {/* Premium medical-clinical background glow effects */}
      <div className="pointer-events-none absolute -right-40 -top-40 size-[500px] rounded-full bg-primary/8 blur-[120px] opacity-70" />
      <div className="pointer-events-none absolute -left-40 -bottom-40 size-[500px] rounded-full bg-primary/5 blur-[120px] opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-primary/[0.03] blur-[150px]" />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-6 flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top,0px))]">
        <AppLogo href="/" />
        <Badge variant="outline" className="px-3 py-1 text-xs border-primary/20 bg-primary/5 text-primary font-medium backdrop-blur-sm">
          {badge} Portalı
        </Badge>
      </header>

      {/* Main Content (Centered Form) */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md mx-auto space-y-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 border-t border-slate-200/40 flex items-center justify-center text-xs text-muted-foreground">
        <p>© 2026 Erciyes Üniversitesi Tıp Fakültesi. Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
}
