import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const FEATURES = [
  { title: "Uzman değerlendirme", desc: "Branş doktorlarından ikinci görüş" },
  { title: "Güvenli süreç", desc: "KVKK uyumlu, uçtan uca şifreli erişim" },
  { title: "Online takip", desc: "Başvuru, ödeme ve rapor tek panelde" },
];

const STEPS = [
  { n: "01", title: "Kayıt & başvuru", desc: "Hesap oluşturun, danışmanlık talebinizi iletin" },
  { n: "02", title: "Ödeme", desc: "Güvenli ödeme ile süreci başlatın" },
  { n: "03", title: "Değerlendirme", desc: "Uzman ekibimiz dosyanızı inceler" },
  { n: "04", title: "Rapor", desc: "Sonuç ve öneriler size ulaştırılır" },
];

export default function HomePage() {
  return (
    <div className="landing-page min-h-svh flex flex-col bg-background text-foreground">
      <header className="relative z-10 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <AppLogo href="/" showText={false} className="sm:hidden" />
          <AppLogo href="/" className="hidden sm:flex" />
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.patient.login}>Giriş yap</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={ROUTES.patient.register}>Kayıt ol</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="landing-glow pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-8 sm:pt-16 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="w-fit">
                  Erciyes Üniversitesi Hastanesi
                </Badge>
                <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                  Uzman görüşü,
                  <span className="landing-gradient-text block">evden tek tıkla</span>
                </h1>
                <p className="text-muted-foreground max-w-xl text-lg font-medium leading-relaxed">
                  Tıbbi danışmanlık ve ikinci görüş başvurunuzu oluşturun, süreci anlık takip edin,
                  raporunuza güvenle ulaşın.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link href={ROUTES.patient.register}>Hemen başvur</Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                  <Link href={ROUTES.patient.login}>Başvurularım</Link>
                </Button>
              </div>

              <ul className="flex flex-wrap gap-2 pt-2">
                {["256-bit güvenlik", "7/24 başvuru", "Uzman kadro"].map((t) => (
                  <li key={t}>
                    <Badge variant="secondary">{t}</Badge>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <Card className="landing-card-main shadow-lg">
                <CardHeader>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                    Canlı süreç
                  </CardDescription>
                  <CardTitle className="text-2xl">Başvuru durumu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Başvuru alındı", done: true },
                    { label: "Uzman incelemesi", done: true },
                    { label: "Rapor hazırlanıyor", done: false, active: true },
                    { label: "Tamamlandı", done: false },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          s.done
                            ? "bg-primary text-primary-foreground"
                            : s.active
                              ? "ring-2 ring-primary bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.done ? "✓" : "·"}
                      </span>
                      <span
                        className={`text-sm font-semibold ${s.active ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="border-t pt-6">
                  <p className="text-muted-foreground text-xs">
                    Ortalama değerlendirme süresi{" "}
                    <strong className="text-foreground">48 saat</strong>
                  </p>
                </CardFooter>
              </Card>
              <Card className="landing-card-float absolute -bottom-6 -left-4 hidden sm:block">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    K
                  </span>
                  <div>
                    <p className="text-sm font-bold">Kardiyoloji</p>
                    <p className="text-muted-foreground text-xs">İkinci görüş · Aktif</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <section className="mt-20 grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                  <CardDescription>{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </section>

          <section className="mt-16">
            <div className="mb-8 space-y-2 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">Nasıl çalışır?</h2>
              <p className="text-muted-foreground mx-auto max-w-lg text-sm font-medium">
                Dört adımda başvurunuzu tamamlayın
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <Card key={s.n} className="group">
                  <CardHeader>
                    <span className="landing-step-num text-3xl font-bold">{s.n}</span>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <CardDescription>{s.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-8 sm:text-left">
          <p className="text-muted-foreground text-xs font-medium">
            © {new Date().getFullYear()} Erciyes Üniversitesi · Tıbbi Danışmanlık Platformu
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
            <Link href={ROUTES.patient.login} className="text-muted-foreground hover:text-foreground">
              Hasta girişi
            </Link>
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
            <Link href={ROUTES.doctor.login} className="text-muted-foreground hover:text-foreground">
              Doktor girişi
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
