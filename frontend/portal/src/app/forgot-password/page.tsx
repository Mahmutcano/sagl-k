"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  hasErrors,
  normalizePhoneTR,
  validateOTP,
  validatePassword,
  validatePhoneTR,
  type FieldErrors,
} from "@/lib/validation";
import { AuthShell } from "@/components/AuthShell";
import { FormAlert, TextInput } from "@/components/FormField";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const f: FieldErrors = {};
    const phoneErr = validatePhoneTR(phoneNumber);
    if (phoneErr) f.phoneNumber = phoneErr;
    setFields(f);
    if (hasErrors(f)) return;

    setLoading(true);
    try {
      await api(API.auth.forgotInitiate, {
        method: "POST",
        body: JSON.stringify({ phoneNumber: normalizePhoneTR(phoneNumber) }),
      });
      setStep("reset");
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setFields(err.fields);
      }
      setFormError(err instanceof ApiError ? err.message : "İşlem başarısız.");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const f: FieldErrors = {};
    const otpErr = validateOTP(code);
    if (otpErr) f.code = otpErr;
    const passErr = validatePassword(password);
    if (passErr) f.password = passErr;
    setFields(f);
    if (hasErrors(f)) return;

    setLoading(true);
    try {
      await api(API.auth.forgotComplete, {
        method: "POST",
        body: JSON.stringify({
          phoneNumber: normalizePhoneTR(phoneNumber),
          code,
          password,
        }),
      });
      router.push("/login");
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setFields(err.fields);
      }
      setFormError(err instanceof ApiError ? err.message : "Şifre güncellenemedi.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "reset") {
    return (
      <AuthShell>
        <div className="card w-full">
          <header>
            <h2>Yeni şifre</h2>
            <p>
              <span className="font-medium">{normalizePhoneTR(phoneNumber)}</span> numarasına
              gönderilen kodu ve yeni şifrenizi girin.
            </p>
          </header>
          <section>
            <form onSubmit={handleComplete} className="flex flex-col gap-4" noValidate>
              {formError ? <FormAlert title="Hata" message={formError} /> : null}
              <TextInput
                id="code"
                label="Doğrulama kodu"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={fields.code}
              />
              <TextInput
                id="password"
                label="Yeni şifre"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fields.password}
              />
              <button type="submit" className="btn w-full" disabled={loading}>
                {loading ? "Kaydediliyor..." : "Şifreyi güncelle"}
              </button>
            </form>
          </section>
          <footer className="border-t">
            <button
              type="button"
              className="btn"
              data-variant="link"
              data-size="sm"
              onClick={() => setStep("phone")}
            >
              Telefonu değiştir
            </button>
          </footer>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="card w-full">
        <header>
          <h2>Şifremi unuttum</h2>
          <p>Kayıtlı cep telefonunuza doğrulama kodu gönderilir.</p>
        </header>
        <section>
          <form onSubmit={handleInitiate} className="flex flex-col gap-4" noValidate>
            {formError ? <FormAlert title="Hata" message={formError} /> : null}
            <TextInput
              id="phoneNumber"
              label="Cep telefonu"
              placeholder="5XX XXX XX XX"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              error={fields.phoneNumber}
            />
            <button type="submit" className="btn w-full" disabled={loading}>
              {loading ? "Gönderiliyor..." : "Kod gönder"}
            </button>
          </form>
        </section>
        <footer className="border-t">
          <Link href="/login" className="btn" data-variant="link" data-size="sm">
            Girişe dön
          </Link>
        </footer>
      </div>
    </AuthShell>
  );
}
