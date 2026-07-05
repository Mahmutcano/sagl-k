import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";

type AuthShellProps = {
  children: React.ReactNode;
  badge?: string;
};

const SIDEBAR: Record<string, { title: string; description: string }> = {
  Hasta: {
    title: "Hasta portalı",
    description: "Başvurularınızı oluşturun, ödemenizi tamamlayın ve süreci takip edin.",
  },
  Doktor: {
    title: "Doktor paneli",
    description: "Size atanan başvuruları inceleyin, rapor hazırlayın ve sonuçlandırın.",
  },
  Yönetim: {
    title: "Yönetim paneli",
    description: "Kurumlar, ödemeler, iadeler ve operasyonel özet.",
  },
};

export function AuthShell({ children, badge = "Hasta" }: AuthShellProps) {
  const copy = SIDEBAR[badge] ?? SIDEBAR.Hasta;

  return (
    <div className="min-h-svh grid lg:grid-cols-2 bg-background text-foreground">
      <aside className="auth-sidebar relative hidden flex-col justify-between overflow-hidden p-8 lg:flex xl:p-12">
        <div className="auth-sidebar-glow pointer-events-none absolute inset-0" aria-hidden />
        <AppLogo href="/" inverted className="relative z-10" />
        <div className="relative z-10 space-y-4 max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-primary-foreground">
            {copy.title}
          </h1>
          <p className="text-primary-foreground/80 text-sm leading-relaxed">{copy.description}</p>
        </div>
        <p className="relative z-10 text-primary-foreground/60 text-xs">
          Erciyes Üniversitesi · Güvenli erişim
        </p>
      </aside>
      <div className="flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <AppLogo href="/" showText={false} />
          <Badge variant="secondary">{badge}</Badge>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
