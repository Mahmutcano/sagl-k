"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { API } from "@/lib/endpoints";
import { ApiError, api } from "@/lib/api";
import { formatPersonName, hasErrors, validateEmail, validatePersonName, type FieldErrors } from "@/lib/validation";
import { AppLogo } from "@/components/AppLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert, FormSelect, TextInput } from "@/components/FormField";
import {
  ArrowRight,
  Building,
  ChatRound,
  ClipboardCheck,
  DocumentText2,
  Health,
  Hospital,
  ProfileAdd2,
  ShieldCheck,
  type IconComponent,
} from "@/components/icons/reicon";

const WORKFLOW: {
  step: string;
  title: string;
  desc: string;
  Icon: IconComponent;
}[] = [
  {
    step: "01",
    title: "Kayıt ve giriş",
    desc: "Hasta hesabınızı oluşturun veya mevcut hesabınızla giriş yapın.",
    Icon: ProfileAdd2,
  },
  {
    step: "02",
    title: "Bölüm ve uzman seçimi",
    desc: "Danışmak istediğiniz bölümü ve uzman hekimi seçerek başvurunuzu başlatın.",
    Icon: Health,
  },
  {
    step: "03",
    title: "Şikayet ve belgeler",
    desc: "Tıbbi öykünüzü, şikayetlerinizi ve varsa raporlarınızı güvenle yükleyin.",
    Icon: DocumentText2,
  },
  {
    step: "04",
    title: "Form önizleme",
    desc: "Başvuru özetinizi kontrol edin ve süreci onaylayarak devam edin.",
    Icon: ClipboardCheck,
  },
  {
    step: "05",
    title: "Uzman değerlendirme",
    desc: "Seçtiğiniz uzman hekim başvurunuzu inceler; gerekirse mesajlaşma ile iletişim kurulur.",
    Icon: ChatRound,
  },
  {
    step: "06",
    title: "Rapor ve takip",
    desc: "Sonuç raporunuza panelinizden ulaşın; süreci baştan sona takip edin.",
    Icon: ClipboardCheck,
  },
];

const HOW_TO = [
  {
    q: "Kimler başvurabilir?",
    a: "18 yaş üstü bireyler kendi adına; yakınları için de temsilci olarak başvuru oluşturabilir.",
  },
  {
    q: "Hangi belgeler gerekli?",
    a: "Şikayet ve öykü metinleri zorunludur. PDF, JPEG veya PNG formatında tıbbi belgeler isteğe bağlı eklenebilir.",
  },
  {
    q: "Süreç nasıl ilerler?",
    a: "Başvurunuzu oluşturup formu tamamladıktan sonra uzman hekim değerlendirmenizi panelinizden takip edersiniz.",
  },
  {
    q: "Doktorla nasıl iletişim kurarım?",
    a: "Başvuru incelemeye alındıktan sonra başvuru detayındaki mesajlaşma bölümünden uzman hekiminize yazabilirsiniz.",
  },
  {
    q: "Raporuma nasıl ulaşırım?",
    a: "Değerlendirme tamamlandığında Sonuçlarım ve başvuru detayı ekranlarından raporunuza erişebilirsiniz.",
  },
];

const TRUST: { title: string; desc: string; Icon: IconComponent }[] = [
  { title: "Kurumsal altyapı", desc: "Erciyes Üniversitesi Hastanesi güvencesi", Icon: Building },
  { title: "KVKK uyumlu", desc: "Uçtan uca şifreli, güvenli veri işleme", Icon: ShieldCheck },
  { title: "Uzman kadro", desc: "Branş hekimlerinden ikinci görüş", Icon: Hospital },
];

export default function HomePage() {
  const [contact, setContact] = useState({
    fullName: "",
    email: "",
    phone: "",
    category: "suggestion",
    subject: "",
    message: "",
  });
  const [contactFields, setContactFields] = useState<FieldErrors>({});
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  async function submitContact(e: FormEvent) {
    e.preventDefault();
    setContactError("");
    setContactSuccess("");
    const fullName = formatPersonName(contact.fullName);
    const errs: FieldErrors = {};
    const nameErr = validatePersonName(fullName, "Ad soyad");
    if (nameErr) errs.fullName = nameErr;
    const emailErr = validateEmail(contact.email);
    if (emailErr) errs.email = emailErr;
    if (!contact.subject.trim()) errs.subject = "Konu zorunludur.";
    if (contact.message.trim().length < 10) errs.message = "Mesaj en az 10 karakter olmalıdır.";
    setContactFields(errs);
    if (hasErrors(errs)) return;

    setContactLoading(true);
    try {
      await api(API.public.contact, {
        method: "POST",
        body: JSON.stringify({
          ...contact,
          fullName,
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          subject: contact.subject.trim(),
          message: contact.message.trim(),
        }),
      });
      setContactSuccess("Mesajınız alındı. En kısa sürede size dönüş yapacağız.");
      setContact({
        fullName: "",
        email: "",
        phone: "",
        category: "suggestion",
        subject: "",
        message: "",
      });
      setContactFields({});
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setContactFields(err.fields);
      }
      setContactError(err instanceof ApiError ? err.message : "Mesaj gönderilemedi.");
    } finally {
      setContactLoading(false);
    }
  }

  return (
    <div className="landing-page flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-8">
          <AppLogo href="/" showText={false} className="min-[420px]:hidden" />
          <AppLogo href="/" className="hidden min-[420px]:flex" />
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#surec" className="text-muted-foreground hover:text-foreground">
              Süreç
            </a>
            <a href="#nasil-kullanilir" className="text-muted-foreground hover:text-foreground">
              Nasıl kullanılır?
            </a>
            <a href="#iletisim" className="text-muted-foreground hover:text-foreground">
              İletişim
            </a>
          </nav>
          <Button size="sm" className="h-10 shrink-0 px-5 text-sm font-semibold" asChild>
            <Link href={ROUTES.patient.login}>Hasta girişi</Link>
          </Button>
        </div>
      </header>

      <main className="relative flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <section className="relative min-h-[min(88svh,720px)] overflow-hidden border-b border-border/50">
          <div className="absolute inset-0" aria-hidden>
            <Image
              src="/images/hero-doctor-docs.jpg"
              alt="Tıbbi danışmanlık — doktor ve belgeler"
              fill
              priority
              className="object-cover object-[center_30%] sm:object-center"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-background/10" />
          </div>

          <div className="relative mx-auto flex min-h-[min(88svh,720px)] max-w-6xl flex-col justify-start px-4 pb-10 pt-8 sm:px-8 sm:pb-16 sm:pt-12 lg:justify-center lg:pb-20 lg:pt-16">
            <div className="max-w-xl space-y-5 sm:space-y-6">
              <Badge variant="outline" className="border-primary/30 bg-background/80 text-xs backdrop-blur-sm">
                Erciyes Üniversitesi Hastanesi · Tıbbi Danışmanlık
              </Badge>
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Erciyes
                <span className="landing-gradient-text block">Tıbbi Danışmanlık</span>
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-foreground/80 sm:text-lg">
                Uzman hekimlerden ikinci görüş alın. Başvurunuzu oluşturun, belgelerinizi paylaşın
                ve değerlendirmenizi çevrimiçi takip edin.
              </p>
              <div className="hidden flex-wrap gap-3 md:flex">
                <Button size="lg" className="h-12 px-8 font-semibold shadow-sm" asChild>
                  <Link href={ROUTES.patient.login} className="inline-flex items-center gap-2">
                    Hemen başvur
                    <ArrowRight size={18} weight="Outline" color="currentColor" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 bg-background/80 backdrop-blur-sm" asChild>
                  <a href="#nasil-kullanilir">Nasıl kullanılır?</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/50 bg-muted/20">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-8 sm:py-12">
            {TRUST.map((item) => {
              const Icon = item.Icon;
              return (
                <div key={item.title} className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background text-primary shadow-sm">
                    <Icon size={22} weight="Outline" color="currentColor" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="surec" className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">İş akışı</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Başvurudan rapora kurumsal süreç
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Tüm adımlar hasta panelinde şeffaf biçimde ilerler; her aşamada ne yapmanız
              gerektiği açıkça gösterilir.
            </p>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW.map((w) => {
              const Icon = w.Icon;
              return (
                <li
                  key={w.step}
                  className="rounded-lg border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-primary">{w.step}</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon size={18} weight="Outline" color="currentColor" />
                    </div>
                  </div>
                  <h3 className="font-semibold">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section id="nasil-kullanilir" className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="mb-8 space-y-3 sm:mb-10">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Kullanım bilgisi</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Nasıl kullanılır?</h2>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Platformu ilk kez kullanacak hastalar için kısa rehber.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {HOW_TO.map((item) => (
              <div key={item.q} className="rounded-xl border border-border/70 bg-card px-5 py-4 shadow-sm">
                <h3 className="font-semibold text-foreground">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-8">
            <h3 className="text-lg font-semibold">Hızlı başlangıç</h3>
            <ol className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <CheckMark />
                Giriş yapın veya kayıt olun
              </li>
              <li className="flex items-start gap-2">
                <CheckMark />
                Yeni başvuru oluşturun
              </li>
              <li className="flex items-start gap-2">
                <CheckMark />
                Bölüm ve doktor seçin
              </li>
              <li className="flex items-start gap-2">
                <CheckMark />
                Formu tamamlayıp süreci başlatın
              </li>
            </ol>
            <Button className="mt-6" asChild>
              <Link href={ROUTES.patient.login} className="inline-flex items-center gap-2">
                Başvuruya başla
                <ArrowRight size={16} weight="Outline" color="currentColor" />
              </Link>
            </Button>
          </div>
        </section>

        <section id="iletisim" className="border-t border-border/50 bg-muted/20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">İletişim</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">İletişime geçin</h2>
              <p className="max-w-md text-sm text-muted-foreground sm:text-base">
                Şikayet, öneri veya destek taleplerinizi buradan iletebilirsiniz. Mesajınız hem
                e-posta ile hem de yönetim paneline düşer.
              </p>
            </div>

            <form onSubmit={submitContact} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6" noValidate>
              {contactError ? <FormAlert title="Hata" message={contactError} /> : null}
              {contactSuccess ? (
                <FormAlert title="Teşekkürler" message={contactSuccess} variant="default" />
              ) : null}
              <TextInput
                id="fullName"
                label="Ad soyad"
                value={contact.fullName}
                onChange={(e) => setContact((c) => ({ ...c, fullName: e.target.value }))}
                onBlur={() =>
                  setContact((c) => ({ ...c, fullName: formatPersonName(c.fullName) }))
                }
                error={contactFields.fullName}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  id="email"
                  label="E-posta"
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  error={contactFields.email}
                />
                <TextInput
                  id="phone"
                  label="Telefon (opsiyonel)"
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                />
              </div>
              <FormSelect
                id="category"
                label="Konu türü"
                value={contact.category}
                onChange={(e) => setContact((c) => ({ ...c, category: e.target.value }))}
                options={[
                  { value: "suggestion", label: "Öneri" },
                  { value: "complaint", label: "Şikayet" },
                  { value: "support", label: "Destek" },
                  { value: "general", label: "Genel" },
                ]}
              />
              <TextInput
                id="subject"
                label="Konu"
                value={contact.subject}
                onChange={(e) => setContact((c) => ({ ...c, subject: e.target.value }))}
                error={contactFields.subject}
              />
              <div className="grid gap-1.5">
                <label htmlFor="message" className="text-sm font-medium">
                  Mesaj
                </label>
                <textarea
                  id="message"
                  rows={4}
                  className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={contact.message}
                  onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                  aria-invalid={contactFields.message ? true : undefined}
                />
                {contactFields.message ? (
                  <p className="text-[0.8rem] font-medium text-destructive">{contactFields.message}</p>
                ) : null}
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={contactLoading}>
                {contactLoading ? "Gönderiliyor..." : "Mesajı gönder"}
              </Button>
            </form>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-4 pt-3 backdrop-blur-md md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Button size="lg" className="h-12 w-full text-base font-semibold" asChild>
          <Link href={ROUTES.patient.login}>Hemen başvur</Link>
        </Button>
      </div>

      <footer className="mt-auto border-t bg-foreground text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <AppLogo href="/" className="[&_span]:text-white" />
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Erciyes Üniversitesi Hastanesi bünyesinde uzaktan tıbbi danışmanlık ve ikinci
                görüş hizmeti.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div className="space-y-2">
                <p className="font-semibold text-white">Hasta</p>
                <Link href={ROUTES.patient.login} className="block hover:text-white">
                  Giriş
                </Link>
                <Link href={ROUTES.patient.register} className="block hover:text-white">
                  Kayıt
                </Link>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-white">Kurum</p>
                <Link href={ROUTES.doctor.login} className="block hover:text-white">
                  Doktor girişi
                </Link>
                <Link href={ROUTES.admin.login} className="block text-muted-foreground hover:text-white">
                  Yönetim
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground sm:text-left">
            © {new Date().getFullYear()} Erciyes Üniversitesi · Tıbbi Danışmanlık Platformu
          </p>
        </div>
      </footer>
    </div>
  );
}

function CheckMark() {
  return (
    <span className="mt-0.5 inline-flex text-primary">
      <ShieldCheck size={16} weight="Outline" color="currentColor" />
    </span>
  );
}
