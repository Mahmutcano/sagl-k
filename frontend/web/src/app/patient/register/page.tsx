"use client";

import { ROUTES } from "@/lib/routes";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, persistAuth, type AuthUser } from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  hasErrors,
  normalizePhoneTR,
  validateOTP,
  validateRegister,
  type FieldErrors,
} from "@/lib/validation";
import { AuthShell } from "@/components/AuthShell";
import { BirthDateSelect, FormAlert, FormSelect, TextInput } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { AgreementModal } from "@/components/AgreementModal";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type LoginResult = {
  accessToken: string;
  refreshToken?: string;
  user?: AuthUser;
};

type Agreement = {
  id: string;
  title: string;
  isRequired: boolean;
};

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  if (digits.length <= 9) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nationalIdentifier: "",
    phoneNumber: "",
    email: "",
    password: "",
    dateOfBirth: "",
    gender: 0,
  });
  const [code, setCode] = useState("");
  /** Mock/stage SMS: API returns code when SMS_PROVIDER=mock */
  const [mockSmsCode, setMockSmsCode] = useState("");
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [acceptedAgreements, setAcceptedAgreements] = useState<Record<string, boolean>>({});
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [modalOpen, setModalOpen] = useState<"terms" | "kvkk" | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    api<Agreement[]>(API.auth.agreements)
      .then((items) => {
        setAgreements(items ?? []);
        const init: Record<string, boolean> = {};
        for (const a of items ?? []) init[a.id] = false;
        setAcceptedAgreements(init);
      })
      .catch(() => {});
  }, []);

  function scrollToFirstError(errs: FieldErrors) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    const id = firstKey.startsWith("agreement_") ? "agreements" : firstKey;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function summarizeErrors(errs: FieldErrors): string {
    const msgs = Object.values(errs);
    if (msgs.length === 0) return "Lütfen işaretli alanları düzeltin.";
    if (msgs.length === 1) return msgs[0];
    return `Lütfen ${msgs.length} alanı düzeltin: ${msgs.slice(0, 3).join(" · ")}`;
  }

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const local = validateRegister(form);
    for (const a of agreements) {
      if (a.isRequired && !acceptedAgreements[a.id]) {
        local[`agreement_${a.id}`] = `${a.title} kabul edilmelidir.`;
      }
    }
    setFields(local);
    if (hasErrors(local)) {
      setFormError(summarizeErrors(local));
      scrollToFirstError(local);
      return;
    }

    setLoading(true);
    try {
      const res = await api<{ sent?: boolean; code?: string }>(API.auth.registerInitiate, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          gender: form.gender,
          phoneNumber: normalizePhoneTR(form.phoneNumber),
          nationalIdentifier: form.nationalIdentifier.trim(),
          nationality: "TR",
        }),
      });
      setMockSmsCode(res?.code?.trim() ?? "");
      setStep("otp");
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length) {
          setFields(err.fields);
          setFormError(summarizeErrors(err.fields));
          scrollToFirstError(err.fields);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Sunucuya bağlanılamadı. Backend çalışıyor mu? (port 8080)");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const otpErr = validateOTP(code);
    if (otpErr) {
      setFields({ code: otpErr });
      return;
    }
    setLoading(true);
    try {
      const phone = normalizePhoneTR(form.phoneNumber);
      const result = await api<LoginResult>(API.auth.registerComplete, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          phoneNumber: phone,
          nationalIdentifier: form.nationalIdentifier.trim(),
          nationality: "TR",
          code: code.trim(),
        }),
      });
      persistAuth(result);
      router.push(ROUTES.patient.home);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length) {
          setFields(err.fields);
          setFormError(summarizeErrors(err.fields));
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Kayıt tamamlanamadı.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <AuthShell badge="Hasta">
        <Card className="large-form w-full shadow-premium-lg">
          <CardHeader>
            <CardTitle>SMS doğrulama</CardTitle>
            <CardDescription>
              <span className="font-medium">{formatPhoneInput(normalizePhoneTR(form.phoneNumber))}</span>{" "}
              numarasına gönderilen kodu girin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleComplete} className="flex flex-col gap-4" noValidate>
              {formError ? <FormAlert title="Doğrulama hatası" message={formError} /> : null}
              <TextInput
                id="code"
                label="Doğrulama kodu"
                hint="4–8 haneli SMS kodu"
                inputMode="numeric"
                maxLength={8}
                autoComplete="one-time-code"
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={fields.code}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Doğrulanıyor..." : "Kaydı tamamla"}
              </Button>
              {mockSmsCode ? (
                <p className="rounded-md border border-dashed border-amber-500/50 bg-amber-50 px-3 py-2 text-center text-sm text-amber-950">
                  Test SMS kodu:{" "}
                  <span className="font-mono text-base font-semibold tracking-widest">{mockSmsCode}</span>
                </p>
              ) : null}
            </form>
          </CardContent>
          <CardFooter className="border-t">
            <Button variant="ghost" size="sm" onClick={() => setStep("form")}>
              Bilgileri düzenle
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell badge="Hasta">
      <Card className="large-form w-full max-w-xl mx-auto shadow-premium-lg">
        <CardHeader>
          <CardTitle>Hesap oluştur</CardTitle>
          <CardDescription>Tüm alanlar doğrulanır; SMS ile telefonunuzu onaylarsınız.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInitiate} className="flex flex-col gap-5" noValidate>
            {formError ? <FormAlert title="Kayıt hatası" message={formError} /> : null}

            <fieldset className="space-y-4">
              <legend className="text-sm font-medium mb-1">Kimlik bilgileri</legend>
              <div className="grid gap-4 grid-cols-2 min-w-0">
                <TextInput
                  id="firstName"
                  label="Ad"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  error={fields.firstName}
                />
                <TextInput
                  id="lastName"
                  label="Soyad"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  error={fields.lastName}
                />
              </div>
              <TextInput
                id="nationalIdentifier"
                label="TC Kimlik No"
                hint="11 haneli, algoritma kontrollü"
                inputMode="numeric"
                maxLength={11}
                value={form.nationalIdentifier}
                onChange={(e) => update("nationalIdentifier", e.target.value)}
                error={fields.nationalIdentifier}
              />
              <BirthDateSelect
                value={form.dateOfBirth}
                onChange={(iso) => update("dateOfBirth", iso)}
                error={fields.dateOfBirth}
              />
              <div className="max-w-xs">
                <FormSelect
                  id="gender"
                  label="Cinsiyet"
                  placeholder="Seçiniz"
                  value={form.gender ? String(form.gender) : undefined}
                  onChange={(e) => update("gender", Number(e.target.value))}
                  error={fields.gender}
                  options={[
                    { value: "1", label: "Erkek" },
                    { value: "2", label: "Kadın" },
                  ]}
                />
              </div>
            </fieldset>

            <div className="relative py-1">
              <Separator />
              <span className="bg-background text-muted-foreground absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs whitespace-nowrap">
                İletişim ve güvenlik
              </span>
            </div>

            <fieldset className="space-y-4">
              <div className="grid gap-4 grid-cols-2 min-w-0">
                <TextInput
                  id="phoneNumber"
                  label="Telefon"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0538 443 97 01"
                  value={form.phoneNumber}
                  onChange={(e) => update("phoneNumber", formatPhoneInput(e.target.value))}
                  error={fields.phoneNumber}
                  fieldClassName="min-w-0"
                />
                <TextInput
                  id="email"
                  label="E-posta"
                  type="email"
                  autoComplete="email"
                  placeholder="ornek@mail.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  error={fields.email}
                  fieldClassName="min-w-0"
                />
              </div>
              <TextInput
                id="password"
                label="Şifre"
                type="password"
                hint="En az 8 karakter, büyük/küçük harf ve rakam"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                error={fields.password}
              />
            </fieldset>

            {agreements.length > 0 ? (
              <fieldset id="agreements" className="space-y-3 rounded-lg border p-4">
                <legend className="px-1 text-sm font-medium text-foreground">Sözleşmeler</legend>
                {agreements.map((a) => {
                  const isKVKK = a.title.toLowerCase().includes("kvkk");
                  const type = isKVKK ? "kvkk" : "terms";
                  return (
                    <div key={a.id} className="flex items-start gap-2.5 text-sm py-1">
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0 cursor-not-allowed"
                        checked={acceptedAgreements[a.id] ?? false}
                        readOnly
                        onClick={(e) => {
                          e.preventDefault();
                          setModalOpen(type);
                        }}
                      />
                      <span className="text-foreground/80">
                        <button
                          type="button"
                          className="text-primary font-semibold underline hover:text-primary/80 inline mr-1 cursor-pointer"
                          onClick={() => setModalOpen(type)}
                        >
                          {a.title}
                        </button>
                        metnini okudum ve onaylıyorum {a.isRequired ? " *" : ""}
                      </span>
                    </div>
                  );
                })}
                {Object.entries(fields)
                  .filter(([k]) => k.startsWith("agreement_"))
                  .map(([k, v]) => (
                    <p key={k} className="text-destructive text-xs">
                      {v}
                    </p>
                  ))}
              </fieldset>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Gönderiliyor..." : "SMS kodu gönder"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="border-t flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">Zaten hesabınız var mı?</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.patient.login}>Hasta girişi</Link>
          </Button>
        </CardFooter>
      </Card>
      
      <AgreementModal
        isOpen={modalOpen !== null}
        onClose={() => setModalOpen(null)}
        onAccept={() => {
          if (modalOpen === "terms") {
            const agreement = agreements.find(a => !a.title.toLowerCase().includes("kvkk"));
            if (agreement) {
              setAcceptedAgreements(prev => ({ ...prev, [agreement.id]: true }));
            }
          } else if (modalOpen === "kvkk") {
            const agreement = agreements.find(a => a.title.toLowerCase().includes("kvkk"));
            if (agreement) {
              setAcceptedAgreements(prev => ({ ...prev, [agreement.id]: true }));
            }
          }
        }}
        title={modalOpen === "terms" ? "Kullanım Koşulları" : "KVKK Aydınlatma Metni"}
        type={modalOpen ?? "terms"}
      />
    </AuthShell>
  );
}
