"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { ApiError, api, persistAuth, type AuthUser } from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  formatPersonName,
  hasErrors,
  isTurkishNationality,
  validateOTP,
  validateRegister,
  type FieldErrors,
} from "@/lib/validation";
import { DEFAULT_PHONE_COUNTRY, formatPhoneDisplay, normalizeNationalNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { AuthShell } from "@/components/AuthShell";
import { BirthDateSelect, FormAlert, FormSelect, TextInput } from "@/components/FormField";
import { PasswordInput } from "@/components/PasswordInput";
import { PhoneNumberField } from "@/components/PhoneNumberField";
import { CountrySearchSelect } from "@/components/CountrySearchSelect";
import { OtpExpiryBanner, DEFAULT_OTP_SECONDS } from "@/components/OtpExpiryBanner";
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

function RegisterSteps({ current }: { current: "form" | "otp" }) {
  const steps = [
    { id: "form", label: "Bilgiler" },
    { id: "otp", label: "SMS Doğrulama" },
  ] as const;

  return (
    <ol className="mb-1 flex items-center gap-2" aria-label="Kayıt adımları">
      {steps.map((step, index) => {
        const active = step.id === current;
        const done = current === "otp" && step.id === "form";
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : index + 1}
            </div>
            <span
              className={cn(
                "truncate text-xs font-semibold sm:text-sm",
                active || done ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <div
                className={cn(
                  "mx-1 hidden h-px flex-1 sm:block",
                  done ? "bg-primary/40" : "bg-muted"
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function PasswordHints({ password }: { password: string }) {
  const checks = useMemo(
    () => [
      { ok: password.length >= 8, label: "En az 8 karakter" },
      { ok: /[A-Z]/.test(password), label: "Büyük harf" },
      { ok: /[a-z]/.test(password), label: "Küçük harf" },
      { ok: /\d/.test(password), label: "Rakam" },
    ],
    [password]
  );

  if (!password) return null;

  return (
    <ul className="mt-2 grid grid-cols-2 gap-1.5">
      {checks.map((c) => (
        <li
          key={c.label}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            c.ok ? "text-emerald-700" : "text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full",
              c.ok ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
            )}
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nationality: "TR",
    nationalIdentifier: "",
    passportNumber: "",
    phoneCountryCode: DEFAULT_PHONE_COUNTRY.dial,
    phoneNumber: "",
    email: "",
    password: "",
    dateOfBirth: "",
    gender: 0,
  });
  const [code, setCode] = useState("");
  const [mockSmsCode, setMockSmsCode] = useState("");
  const [otpExpiresIn, setOtpExpiresIn] = useState(DEFAULT_OTP_SECONDS);
  const [otpExpiresAt, setOtpExpiresAt] = useState("");
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [otpExpired, setOtpExpired] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [acceptedAgreements, setAcceptedAgreements] = useState<Record<string, boolean>>({});
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [modalOpen, setModalOpen] = useState<"terms" | "kvkk" | null>(null);
  const [loading, setLoading] = useState(false);

  const isTR = isTurkishNationality(form.nationality);
  const pendingOtpValid =
    otpSent &&
    !!otpExpiresAt &&
    !Number.isNaN(Date.parse(otpExpiresAt)) &&
    Date.parse(otpExpiresAt) > Date.now() &&
    !otpExpired;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fields[key]) {
      setFields((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
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

  function registerPayload() {
    const phoneNumber = normalizeNationalNumber(form.phoneNumber, form.phoneCountryCode);
    return {
      firstName: formatPersonName(form.firstName),
      lastName: formatPersonName(form.lastName),
      nationality: form.nationality,
      nationalIdentifier: isTR ? form.nationalIdentifier.trim() : "",
      passportNumber: isTR ? "" : form.passportNumber.trim().toUpperCase(),
      phoneCountryCode: form.phoneCountryCode,
      phoneNumber,
      email: form.email.trim(),
      password: form.password,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
    };
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
      const res = await api<{
        sent?: boolean;
        code?: string;
        expiresInSeconds?: number;
        expiresAt?: string;
      }>(API.auth.registerInitiate, {
        method: "POST",
        body: JSON.stringify(registerPayload()),
      });
      setMockSmsCode(res?.code?.trim() ?? "");
      setOtpExpiresIn(
        res?.expiresInSeconds && res.expiresInSeconds > 0
          ? res.expiresInSeconds
          : DEFAULT_OTP_SECONDS
      );
      setOtpExpiresAt(res?.expiresAt ?? "");
      setOtpResetKey((k) => k + 1);
      setOtpExpired(false);
      setOtpSent(true);
      setCode("");
      setFields({});
      setFormError("");
      setStep("otp");
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        setFormError("Sunucuya bağlanılamadı. Lütfen daha sonra tekrar deneyin.");
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
      const result = await api<LoginResult>(API.auth.registerComplete, {
        method: "POST",
        body: JSON.stringify({
          ...registerPayload(),
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
      <AuthShell badge="Hasta" wide>
        <Card className="w-full bg-card/90 backdrop-blur-md">
          <CardHeader className="space-y-4">
            <RegisterSteps current="otp" />
            <div className="space-y-1.5 text-center sm:text-left">
              <CardTitle>Telefonunuzu doğrulayın</CardTitle>
              <CardDescription>
                <span className="font-semibold text-foreground">
                  {formatPhoneDisplay(form.phoneCountryCode, form.phoneNumber)}
                </span>{" "}
                numarasına gönderilen 6 haneli kodu girin.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleComplete} className="flex flex-col gap-4" noValidate>
              {formError ? <FormAlert title="Doğrulama hatası" message={formError} /> : null}

              <OtpExpiryBanner
                expiresInSeconds={otpExpiresIn}
                expiresAt={otpExpiresAt || undefined}
                resetKey={otpResetKey}
                onExpired={() => setOtpExpired(true)}
              />

              <TextInput
                id="code"
                label="Doğrulama kodu"
                hint="SMS ile gelen kod"
                inputMode="numeric"
                maxLength={8}
                autoComplete="one-time-code"
                autoFocus
                placeholder="6 haneli kod"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                error={fields.code}
                disabled={otpExpired}
              />

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={loading || code.length < 4 || otpExpired}
              >
                {loading ? (
                  "Doğrulanıyor..."
                ) : (
                  <>
                    Kaydı tamamla
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              {mockSmsCode ? (
                <p className="rounded-md border border-dashed border-amber-500/50 bg-amber-50 px-3 py-2 text-center text-sm text-amber-950">
                  Test SMS kodu:{" "}
                  <span className="font-mono text-base font-semibold tracking-widest">
                    {mockSmsCode}
                  </span>
                </p>
              ) : null}
            </form>
          </CardContent>
          <CardFooter className="border-t">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-0 text-muted-foreground"
              onClick={() => {
                setStep("form");
                setCode("");
                setFormError("");
                setFields({});
              }}
            >
              ← Bilgileri düzenle
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell badge="Hasta" wide>
      <Card className="w-full bg-card/90 backdrop-blur-md">
        <CardHeader className="space-y-4">
          <RegisterSteps current="form" />
          <div className="space-y-1.5">
            <CardTitle>Hasta hesabı oluştur</CardTitle>
            <CardDescription>
              Bilgilerinizi girin; ardından telefonunuza gelen SMS kodu ile kaydı tamamlayın.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleInitiate} className="flex flex-col gap-6" noValidate>
            {formError ? <FormAlert title="Kayıt hatası" message={formError} /> : null}

            {pendingOtpValid ? (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
                <p className="font-medium text-foreground">
                  Aktif bir doğrulama kodunuz var. Süre backend’den gelen bitiş zamanına göre
                  devam eder.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setStep("otp");
                    setFormError("");
                    setFields({});
                  }}
                >
                  Doğrulamaya devam et
                </Button>
              </div>
            ) : null}

            <section className="space-y-4">
              <h2 className="text-sm font-bold tracking-tight text-foreground">Kimlik bilgileri</h2>
              <div className="grid min-w-0 grid-cols-1 gap-4">
                <TextInput
                  id="firstName"
                  label="Ad"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  onBlur={() => update("firstName", formatPersonName(form.firstName))}
                  error={fields.firstName}
                />
                <TextInput
                  id="lastName"
                  label="Soyad"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  onBlur={() => update("lastName", formatPersonName(form.lastName))}
                  error={fields.lastName}
                />
              </div>

              <CountrySearchSelect
                id="nationality"
                label="Uyruk"
                mode="nationality"
                value={form.nationality || "TR"}
                onChange={(code) => {
                  setForm((prev) => ({
                    ...prev,
                    nationality: code,
                    passportNumber: isTurkishNationality(code) ? "" : prev.passportNumber,
                    nationalIdentifier: isTurkishNationality(code) ? prev.nationalIdentifier : "",
                  }));
                  setFields((prev) => {
                    const nextFields = { ...prev };
                    delete nextFields.nationality;
                    delete nextFields.passportNumber;
                    delete nextFields.nationalIdentifier;
                    return nextFields;
                  });
                }}
                error={fields.nationality}
              />

              {isTR ? (
                <TextInput
                  id="nationalIdentifier"
                  label="TC Kimlik No"
                  hint="11 haneli kimlik numaranız"
                  inputMode="numeric"
                  maxLength={11}
                  value={form.nationalIdentifier}
                  onChange={(e) =>
                    update("nationalIdentifier", e.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                  error={fields.nationalIdentifier}
                />
              ) : (
                <TextInput
                  id="passportNumber"
                  label="Pasaport No"
                  hint="Pasaport numaranız"
                  autoComplete="off"
                  maxLength={20}
                  value={form.passportNumber}
                  onChange={(e) =>
                    update(
                      "passportNumber",
                      e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20)
                    )
                  }
                  error={fields.passportNumber}
                />
              )}

              <div className="grid min-w-0 grid-cols-1 gap-4">
                <BirthDateSelect
                  value={form.dateOfBirth}
                  onChange={(iso) => update("dateOfBirth", iso)}
                  error={fields.dateOfBirth}
                />
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
            </section>

            <div className="h-px bg-border" />

            <section className="space-y-4">
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                İletişim ve güvenlik
              </h2>
              <PhoneNumberField
                countryDial={form.phoneCountryCode}
                nationalNumber={form.phoneNumber}
                onCountryChange={(dial) => update("phoneCountryCode", dial)}
                onNationalChange={(n) => update("phoneNumber", n)}
                error={fields.phoneNumber}
                hint="Zorunlu — ülke kodu ve cep telefonu"
              />
              <TextInput
                id="email"
                label="E-posta (opsiyonel)"
                type="email"
                autoComplete="email"
                placeholder="ornek@mail.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                error={fields.email}
                hint="İsterseniz bildirimler için e-posta ekleyebilirsiniz"
                fieldClassName="min-w-0"
              />

              <div>
                <PasswordInput
                  id="password"
                  label="Şifre"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  error={fields.password}
                />
                <PasswordHints password={form.password} />
              </div>
            </section>

            {agreements.length > 0 ? (
              <section
                id="agreements"
                className="space-y-3 rounded-xl border bg-muted/60 p-4"
              >
                <h2 className="text-sm font-bold tracking-tight text-foreground">Sözleşmeler</h2>
                <p className="text-xs text-muted-foreground">
                  Devam etmek için metinleri okuyup onaylamanız gerekir.
                </p>
                {agreements.map((a) => {
                  const isKVKK = a.title.toLowerCase().includes("kvkk");
                  const type = isKVKK ? "kvkk" : "terms";
                  const accepted = acceptedAgreements[a.id] ?? false;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setModalOpen(type)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border bg-white px-3 py-3 text-left text-sm transition-colors",
                        accepted
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "hover:border-primary/30 hover:bg-primary/[0.02]",
                        fields[`agreement_${a.id}`] && "border-destructive/40"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                          accepted
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "bg-white"
                        )}
                      >
                        {accepted ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="text-foreground/85 leading-snug">
                        <span className="font-semibold text-primary underline-offset-2">
                          {a.title}
                        </span>{" "}
                        metnini okudum ve onaylıyorum
                        {a.isRequired ? " *" : ""}
                      </span>
                    </button>
                  );
                })}
                {Object.entries(fields)
                  .filter(([k]) => k.startsWith("agreement_"))
                  .map(([k, v]) => (
                    <p key={k} className="text-destructive text-xs font-medium">
                      {v}
                    </p>
                  ))}
              </section>
            ) : null}

            <div className="sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-card via-card to-transparent pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] sm:static sm:bg-none sm:p-0">
              <Button type="submit" className="w-full gap-2 shadow-sm" disabled={loading}>
                {loading ? (
                  "SMS gönderiliyor..."
                ) : (
                  <>
                    SMS kodu gönder
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 border-t bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
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
            const agreement = agreements.find((a) => !a.title.toLowerCase().includes("kvkk"));
            if (agreement) {
              setAcceptedAgreements((prev) => ({ ...prev, [agreement.id]: true }));
              setFields((prev) => {
                const next = { ...prev };
                delete next[`agreement_${agreement.id}`];
                return next;
              });
            }
          } else if (modalOpen === "kvkk") {
            const agreement = agreements.find((a) => a.title.toLowerCase().includes("kvkk"));
            if (agreement) {
              setAcceptedAgreements((prev) => ({ ...prev, [agreement.id]: true }));
              setFields((prev) => {
                const next = { ...prev };
                delete next[`agreement_${agreement.id}`];
                return next;
              });
            }
          }
        }}
        title={modalOpen === "terms" ? "Kullanım Koşulları" : "KVKK Aydınlatma Metni"}
        type={modalOpen ?? "terms"}
      />
    </AuthShell>
  );
}
