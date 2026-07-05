import Link from "next/link";
import { DOCTOR_APP_URL } from "@/lib/urls";

export default function Home() {
  return (
    <main className="min-h-svh bg-background text-foreground flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tıbbi Danışmanlık</h1>
          <p className="text-muted-foreground text-base font-medium">Hasta portalı</p>
        </div>
        <Link href="/login" className="card block text-left transition hover:ring-2 hover:ring-ring">
          <header>
            <h2 className="text-xl font-bold">Hasta girişi</h2>
            <p className="text-base font-medium">Başvuru oluşturma ve takip</p>
          </header>
          <section>
            <span className="badge">Giriş yap</span>
          </section>
        </Link>
        <p className="text-muted-foreground text-sm font-medium">
          Doktor musunuz?{" "}
          <a href={DOCTOR_APP_URL} className="underline underline-offset-4">
            Doktor portalına geçin
          </a>
        </p>
      </div>
    </main>
  );
}
