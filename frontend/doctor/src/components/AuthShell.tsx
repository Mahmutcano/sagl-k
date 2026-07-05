import Link from "next/link";

type AuthShellProps = {
  children: React.ReactNode;
  badge?: string;
};

export function AuthShell({ children, badge = "Doktor" }: AuthShellProps) {
  return (
    <div className="min-h-svh grid lg:grid-cols-2 bg-background text-foreground">
      <aside className="bg-primary text-primary-foreground relative hidden flex-col justify-between p-8 lg:flex xl:p-12">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Tıbbi Danışmanlık
        </Link>
        <div className="space-y-4 max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">Doktor portalı</h1>
          <p className="text-primary-foreground/80 text-sm leading-relaxed">
            Değerlendirme kuyruğunu yönetin ve hasta alanına geçiş yapın.
          </p>
        </div>
      </aside>
      <div className="flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <Link href="/" className="font-semibold tracking-tight">
            Tıbbi Danışmanlık
          </Link>
          <span className="badge" data-variant="secondary">
            {badge}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-lg">{children}</div>
        </div>
      </div>
    </div>
  );
}
