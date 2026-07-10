import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  { title: "Uzman değerlendirme", desc: "Branş doktorlarından ikinci görüş" },
  { title: "Güvenli süreç", desc: "KVKK uyumlu, uçtan uca şifreli erişim" },
  { title: "Online takip", desc: "Başvuru, ödeme ve rapor tek panelde" },
];

const STEPS = [
  { n: "01", title: "Giriş & başvuru", desc: "Hesabınıza girin, danışmanlık talebinizi iletin" },
  { n: "02", title: "Ödeme", desc: "Güvenli ödeme ile süreci başlatın" },
  { n: "03", title: "Değerlendirme", desc: "Uzman ekibimiz dosyanızı inceler" },
  { n: "04", title: "Rapor", desc: "Sonuç ve öneriler size ulaştırılır" },
];

export default function HomePage() {
  return (
    <div className="landing-page flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-8">
          <AppLogo href="/" showText={false} className="sm:hidden" />
          <AppLogo href="/" className="hidden sm:flex" />
          <Button size="sm" className="h-10 min-w-[5.5rem] px-4 text-sm" asChild>
            <Link href={ROUTES.patient.login}>Giriş</Link>
          </Button>
        </div>
      </header>

      <main className="relative flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
        <div className="landing-glow pointer-events-none absolute inset-0" aria-hidden />

        <section className="relative mx-auto grid max-w-6xl items-stretch gap-0 px-0 pt-0 lg:grid-cols-2 lg:px-8 lg:pt-10">
          <div className="relative aspect-[16/10] min-h-[200px] overflow-hidden sm:aspect-auto sm:min-h-[360px] lg:min-h-[520px] lg:rounded-2xl">
            <Image
              src="/images/doctor-hero.jpg"
              alt="Dosyaları elinde tutan deneyimli uzman hekim"
              fill
              priority
              className="object-cover object-[center_18%]"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-background/40" />
          </div>

          <div className="relative z-10 flex flex-col justify-center space-y-6 px-4 py-8 sm:space-y-7 sm:px-8 sm:py-10 lg:pl-12 lg:py-6">
            <div className="space-y-3 sm:space-y-4">
              <Badge variant="outline" className="w-fit text-[11px] sm:text-xs">
                Erciyes Üniversitesi Hastanesi
              </Badge>
              <h1 className="text-[1.85rem] font-bold leading-[1.15] tracking-tight sm:text-4xl lg:text-5xl">
                Uzman görüşü,
                <span className="landing-gradient-text block">evden tek tıkla</span>
              </h1>
              <p className="text-muted-foreground max-w-xl text-[15px] font-medium leading-relaxed sm:text-lg">
                Tıbbi danışmanlık ve ikinci görüş başvurunuzu oluşturun, süreci takip edin,
                raporunuza güvenle ulaşın.
              </p>
            </div>

            {/* Desktop / tablet CTAs — mobile uses sticky bar */}
            <div className="hidden flex-col gap-3 sm:flex">
              <Button size="lg" className="h-12 w-full text-base shadow-md sm:w-auto sm:min-w-[240px]" asChild>
                <Link href={ROUTES.patient.login}>Hemen başvur</Link>
              </Button>
              <p className="text-muted-foreground text-sm">
                Hesabınız yok mu? Giriş ekranından{" "}
                <span className="text-foreground font-medium">kayıt olabilirsiniz</span>.
              </p>
              <p className="text-muted-foreground text-xs">
                Sağlık personeli misiniz?{" "}
                <Link
                  href={ROUTES.doctor.login}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  Doktor girişi
                </Link>
              </p>
            </div>

            <ul className="flex flex-wrap gap-2">
              {["256-bit güvenlik", "7/24 başvuru", "Uzman kadro"].map((t) => (
                <li key={t}>
                  <Badge variant="secondary" className="text-[11px] sm:text-xs">
                    {t}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
          <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="transition-shadow hover:shadow-md">
                <CardHeader className="space-y-1.5 p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">{f.title}</CardTitle>
                  <CardDescription className="text-sm">{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </section>

          <section className="mt-12 sm:mt-16">
            <div className="mb-6 space-y-2 text-center sm:mb-8">
              <h2 className="text-xl font-bold sm:text-3xl">Süreç özeti</h2>
              <p className="text-muted-foreground mx-auto max-w-lg text-sm font-medium">
                Başvurudan rapora kadar süreç şöyle ilerler
              </p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <Card className="group h-full">
                    <CardHeader className="space-y-1.5 p-4 sm:p-6">
                      <span className="landing-step-num text-2xl font-bold sm:text-3xl">{s.n}</span>
                      <CardTitle className="text-base">{s.title}</CardTitle>
                      <CardDescription className="text-sm">{s.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      {/* Mobile sticky CTA — login first */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-4 pt-3 backdrop-blur-md sm:hidden pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Button size="lg" className="h-12 w-full text-base font-semibold shadow-md" asChild>
          <Link href={ROUTES.patient.login}>Hemen başvur</Link>
        </Button>
        <p className="text-muted-foreground mt-2 text-center text-xs leading-snug">
          Hesabınız yoksa giriş ekranından kayıt olabilirsiniz
        </p>
      </div>

      <footer className="hidden border-t bg-muted/30 sm:block">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-8 sm:text-left">
          <p className="text-muted-foreground text-xs font-medium">
            © {new Date().getFullYear()} Erciyes Üniversitesi · Tıbbi Danışmanlık Platformu
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
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
