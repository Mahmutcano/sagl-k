"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, setToken, setUser, type AuthUser } from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  hasErrors,
  normalizePhoneTR,
  validateOTP,
  validateRegister,
  type FieldErrors,
} from "@/lib/validation";
import { AuthShell } from "@/components/AuthShell";
import { FormAlert, FormSelect, TextInput } from "@/components/FormField";

type LoginResult = {
  accessToken: string;
  user?: AuthUser;
};

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
    gender: 1,
  });
  const [code, setCode] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const local = validateRegister(form);
    setFields(local);
    if (hasErrors(local)) return;

    setLoading(true);
    try {
      await api(API.auth.registerInitiate, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          phoneNumber: normalizePhoneTR(form.phoneNumber),
          nationalIdentifier: form.nationalIdentifier.trim(),
          nationality: "TR",
        }),
      });
      setStep("otp");
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length) setFields(err.fields);
        setFormError(err.message);
      } else {
        setFormError("Kayıt başlatılamadı.");
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
          code,
        }),
      });
      setToken(result.accessToken);
      if (result.user) setUser(result.user);
      router.push("/applications");
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length) setFields(err.fields);
        setFormError(err.message);
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
        <div className="card w-full">
          <header>
            <h2>SMS doğrulama</h2>
            <p>
              <span className="font-medium">{normalizePhoneTR(form.phoneNumber)}</span> numarasına
              gönderilen kodu girin.
            </p>
          </header>
          <section>
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
              <button type="submit" className="btn w-full" disabled={loading}>
                {loading ? "Doğrulanıyor..." : "Kaydı tamamla"}
              </button>
            </form>
          </section>
          <footer className="border-t">
            <button
              type="button"
              className="btn"
              data-variant="ghost"
              data-size="sm"
              onClick={() => setStep("form")}
            >
              Bilgileri düzenle
            </button>
          </footer>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell badge="Hasta">
      <div className="card w-full max-w-lg mx-auto">
        <header>
          <h2>Hesap oluştur</h2>
          <p>Tüm alanlar doğrulanır; SMS ile telefonunuzu onaylarsınız.</p>
        </header>
        <section>
          <form onSubmit={handleInitiate} className="flex flex-col gap-4" noValidate>
            {formError ? <FormAlert title="Kayıt hatası" message={formError} /> : null}
            <fieldset className="fieldset">
              <legend>Kimlik bilgileri</legend>
              <div role="group" className="grid gap-4 sm:grid-cols-2">
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
                <TextInput
                  id="nationalIdentifier"
                  label="TC Kimlik No"
                  hint="11 haneli, algoritma kontrollü"
                  inputMode="numeric"
                  maxLength={11}
                  fieldClassName="sm:col-span-2"
                  value={form.nationalIdentifier}
                  onChange={(e) => update("nationalIdentifier", e.target.value)}
                  error={fields.nationalIdentifier}
                />
                <TextInput
                  id="dateOfBirth"
                  label="Doğum tarihi"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => update("dateOfBirth", e.target.value)}
                  error={fields.dateOfBirth}
                />
                <FormSelect
                  id="gender"
                  label="Cinsiyet"
                  value={String(form.gender)}
                  onChange={(e) => update("gender", Number(e.target.value))}
                  error={fields.gender}
                  options={[
                    { value: "1", label: "Erkek" },
                    { value: "2", label: "Kadın" },
                  ]}
                />
              </div>
            </fieldset>

            <div className="field-separator">
              <hr role="separator" />
              <span>İletişim ve güvenlik</span>
            </div>

            <fieldset className="fieldset">
              <div role="group" className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  id="phoneNumber"
                  label="Telefon"
                  hint="5XX XXX XX XX"
                  inputMode="tel"
                  placeholder="5xxxxxxxxx"
                  value={form.phoneNumber}
                  onChange={(e) => update("phoneNumber", e.target.value)}
                  error={fields.phoneNumber}
                />
                <TextInput
                  id="email"
                  label="E-posta"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  error={fields.email}
                />
                <TextInput
                  id="password"
                  label="Şifre"
                  type="password"
                  hint="En az 8 karakter, büyük/küçük harf ve rakam"
                  autoComplete="new-password"
                  fieldClassName="sm:col-span-2"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  error={fields.password}
                />
              </div>
            </fieldset>

            <button type="submit" className="btn w-full" disabled={loading}>
              {loading ? "Gönderiliyor..." : "SMS kodu gönder"}
            </button>
          </form>
        </section>
        <footer className="border-t flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">Zaten hesabınız var mı?</p>
          <Link href="/login" className="btn" data-variant="outline" data-size="sm">
            Hasta girişi
          </Link>
        </footer>
      </div>
    </AuthShell>
  );
}
