import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { title: "Uzman değerlendirme", desc: "Branş doktorlarından ikinci görüş" },
  { title: "Güvenli süreç", desc: "KVKK uyumlu, uçtan uca şifreli erişim" },
  { title: "Online takip", desc: "Başvuru, ödeme ve rapor tek panelde" },
];

const STEPS = [
  { n: "1", title: "Giriş & başvuru", desc: "Hesabınıza girin, talebinizi iletin" },
  { n: "2", title: "Ödeme", desc: "Güvenli ödeme ile süreci başlatın" },
  { n: "3", title: "Değerlendirme", desc: "Uzman ekibimiz dosyanızı inceler" },
  { n: "4", title: "Rapor", desc: "Sonuç ve öneriler size ulaşır" },
];

export default function HomePage() {
  return (
    <div className="landing-page flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/95 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-8">
          <AppLogo href="/" showText={false} className="min-[420px]:hidden" />
          <AppLogo href="/" className="hidden min-[420px]:flex" />
          <Button size="sm" className="h-10 shrink-0 px-5 text-sm font-semibold" asChild>
            <Link href={ROUTES.patient.login}>Giriş</Link>
          </Button>
        </div>
      </header>

      <main className="relative flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <div className="landing-glow pointer-events-none absolute inset-0" aria-hidden />

        {/* Hero: text first, doctor below (mobile) / right (desktop) */}
        <section className="relative mx-auto max-w-6xl px-4 pt-8 sm:px-8 sm:pt-12 lg:pt-14">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 xl:gap-16">
            {/* Copy — always first */}
            <div className="flex flex-col justify-center space-y-5 sm:space-y-6 lg:pb-10">
              <Badge variant="outline" className="w-fit text-[11px] sm:text-xs">
                Erciyes Üniversitesi Hastanesi
              </Badge>

              <div className="space-y-3 sm:space-y-4">
                <h1 className="max-w-xl text-[1.75rem] font-bold leading-[1.18] tracking-tight sm:text-4xl lg:text-[2.75rem]">
                  Uzman görüşü,
                  <span className="landing-gradient-text block">evden tek tıkla</span>
                </h1>
                <p className="text-muted-foreground max-w-md text-[15px] font-medium leading-relaxed sm:text-base lg:text-lg">
                  Tıbbi danışmanlık ve ikinci görüş başvurunuzu oluşturun, süreci takip edin,
                  raporunuza güvenle ulaşın.
                </p>
              </div>

              <div className="hidden space-y-3 md:block">
                <Button size="lg" className="h-12 min-w-[220px] px-8 text-base font-semibold shadow-sm" asChild>
                  <Link href={ROUTES.patient.login}>Hemen başvur</Link>
                </Button>
                <p className="text-muted-foreground text-sm">
                  Hesabınız yok mu? Giriş ekranından kayıt olabilirsiniz.
                </p>
                <p className="text-muted-foreground text-xs">
                  Sağlık personeli misiniz?{" "}
                  <Link
                    href={ROUTES.doctor.login}
                    className="font-medium text-foreground/80 underline-offset-2 hover:underline"
                  >
                    Doktor girişi
                  </Link>
                </p>
              </div>

              <ul className="flex flex-wrap gap-2 pt-1">
                {["256-bit güvenlik", "7/24 başvuru", "Uzman kadro"].map((t) => (
                  <li key={t}>
                    <Badge variant="secondary" className="text-[11px] font-medium sm:text-xs">
                      {t}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>

            {/* Doctor — below text on mobile, right on desktop; head fully visible */}
            <div className="landing-hero-photo relative mx-auto w-full max-w-md justify-self-end lg:mx-0 lg:max-w-none">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted/40 sm:aspect-[3/4] lg:aspect-[4/5] lg:min-h-[480px]">
                <Image
                  src="/images/doctor-hero.jpg"
                  alt="Dosyaları elinde tutan deneyimli uzman hekim"
                  fill
                  priority
                  className="object-cover object-[center_12%]"
                  sizes="(max-width: 1024px) 90vw, 42vw"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/35 via-transparent to-transparent"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features — clean rows, no heavy cards */}
        <section className="relative mx-auto mt-12 max-w-6xl border-t border-border/60 px-4 pt-10 sm:mt-16 sm:px-8 sm:pt-12">
          <div className="grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={
                  i > 0
                    ? "border-t border-border/50 pt-8 sm:border-l sm:border-t-0 sm:pt-0 sm:pl-6 lg:pl-10"
                    : ""
                }
              >
                <h2 className="text-base font-semibold tracking-tight sm:text-lg">{f.title}</h2>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Process summary */}
        <section className="relative mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="mb-8 space-y-2 sm:mb-10 sm:text-center">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">Süreç özeti</h2>
            <p className="text-muted-foreground max-w-lg text-sm font-medium sm:mx-auto">
              Başvurudan rapora kadar süreç şöyle ilerler
            </p>
          </div>

          <ol className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {STEPS.map((s, i) => (
              <li
                key={s.n}
                className="relative flex gap-4 border-b border-border/50 py-5 last:border-b-0 sm:border-b-0 sm:px-4 sm:py-0 lg:px-5"
              >
                {i < STEPS.length - 1 ? (
                  <span
                    className="bg-border absolute top-8 left-[1.15rem] hidden h-[calc(100%-1rem)] w-px lg:left-auto lg:right-0 lg:top-5 lg:block lg:h-px lg:w-full"
                    aria-hidden
                  />
                ) : null}
                <span className="landing-step-num relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-bold">
                  {s.n}
                </span>
                <div className="min-w-0 space-y-1 pt-1">
                  <h3 className="text-sm font-semibold sm:text-base">{s.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-4 pt-3 backdrop-blur-md md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Button size="lg" className="h-12 w-full text-base font-semibold shadow-md" asChild>
          <Link href={ROUTES.patient.login}>Hemen başvur</Link>
        </Button>
        <p className="text-muted-foreground mt-2 text-center text-xs leading-snug">
          Hesabınız yoksa giriş ekranından kayıt olabilirsiniz
        </p>
      </div>

      <footer className="mt-auto hidden border-t bg-muted/20 md:block">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-8 sm:text-left">
          <p className="text-muted-foreground text-xs font-medium">
            © {new Date().getFullYear()} Erciyes Üniversitesi · Tıbbi Danışmanlık Platformu
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-medium">
            <Link href={ROUTES.patient.login} className="font-semibold text-foreground hover:underline">
              Hasta girişi
            </Link>
            <Link href={ROUTES.doctor.login} className="text-muted-foreground hover:text-foreground">
              Doktor girişi
            </Link>
            <Link href={ROUTES.admin.login} className="text-muted-foreground/70 hover:text-foreground">
              Yönetim
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
