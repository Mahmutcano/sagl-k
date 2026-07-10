"use client";

import { ROUTES } from "@/lib/routes";

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
import { PasswordInput } from "@/components/PasswordInput";
import { OtpExpiryBanner, DEFAULT_OTP_SECONDS } from "@/components/OtpExpiryBanner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [mockSmsCode, setMockSmsCode] = useState("");
  const [otpExpiresIn, setOtpExpiresIn] = useState(DEFAULT_OTP_SECONDS);
  const [otpExpiresAt, setOtpExpiresAt] = useState("");
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [otpExpired, setOtpExpired] = useState(false);
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
      const res = await api<{ sent?: boolean; code?: string; expiresInSeconds?: number; expiresAt?: string }>(API.auth.forgotInitiate, {
        method: "POST",
        body: JSON.stringify({ phoneNumber: normalizePhoneTR(phoneNumber) }),
      });
      setMockSmsCode(res?.code?.trim() ?? "");
      setOtpExpiresIn(res?.expiresInSeconds && res.expiresInSeconds > 0 ? res.expiresInSeconds : DEFAULT_OTP_SECONDS);
      setOtpExpiresAt(res?.expiresAt ?? "");
      setOtpResetKey((k) => k + 1);
      setOtpExpired(false);
      setCode("");
      setPassword("");
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
      router.push(ROUTES.patient.login);
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
        <Card className="large-form w-full shadow-premium-lg">
          <CardHeader>
            <CardTitle>Yeni şifre</CardTitle>
            <CardDescription>
              <span className="font-medium">{normalizePhoneTR(phoneNumber)}</span> numarasına
              gönderilen kodu ve yeni şifrenizi girin. Kod sınırlı süre geçerlidir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleComplete} className="flex flex-col gap-4" noValidate>
              {formError ? <FormAlert title="Hata" message={formError} /> : null}
              <OtpExpiryBanner
                expiresInSeconds={otpExpiresIn}
                expiresAt={otpExpiresAt || undefined}
                resetKey={otpResetKey}
                onExpired={() => setOtpExpired(true)}
              />
              <TextInput
                id="code"
                label="Doğrulama kodu"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={fields.code}
                disabled={otpExpired}
              />
              <PasswordInput
                id="password"
                label="Yeni şifre"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fields.password}
                disabled={otpExpired}
              />
              <Button type="submit" className="w-full" disabled={loading || otpExpired}>
                {loading ? "Kaydediliyor..." : "Şifreyi güncelle"}
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
            <Button variant="link" size="sm" onClick={() => setStep("phone")}>
              Telefonu değiştir
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="large-form w-full shadow-premium-lg">
        <CardHeader>
          <CardTitle>Şifremi unuttum</CardTitle>
          <CardDescription>Kayıtlı cep telefonunuza doğrulama kodu gönderilir.</CardDescription>
        </CardHeader>
        <CardContent>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Gönderiliyor..." : "Kod gönder"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="border-t">
          <Button variant="link" size="sm" asChild>
            <Link href="/login">Girişe dön</Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
