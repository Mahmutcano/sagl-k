"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api, getToken } from "@/lib/api";
import {
  FormAlert,
  FormField,
  FormSelect,
  BirthDateSelect,
  TextInput,
} from "@/components/FormField";
import { PasswordInput } from "@/components/PasswordInput";
import { MessageModal } from "@/components/MessageModal";
import { OtpExpiryBanner, DEFAULT_OTP_SECONDS } from "@/components/OtpExpiryBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { type FieldErrors } from "@/lib/validation";

type ProfileData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  nationalIdentifier: string;
  dateOfBirth: string;
  gender: number;
  role: string;
};

export function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<ProfileData>({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    nationalIdentifier: "",
    dateOfBirth: "",
    gender: 0,
    role: "",
  });

  const [fields, setFields] = useState<FieldErrors>({});
  
  // Password fields
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(DEFAULT_OTP_SECONDS);
  const [otpExpiresAt, setOtpExpiresAt] = useState("");
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [otpExpired, setOtpExpired] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    api<ProfileData>("/api/v1/profile", {}, token)
      .then((data) => {
        setForm({
          id: data.id,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          phoneNumber: data.phoneNumber || "",
          nationalIdentifier: data.nationalIdentifier || "",
          dateOfBirth: data.dateOfBirth || "",
          gender: data.gender || 0,
          role: data.role || "",
        });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Profil bilgileri yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    setSaving(true);
    setError("");
    setSuccess("");
    setFields({});

    try {
      const res = await api<{
        requiresPhoneVerify: boolean;
        message: string;
        expiresInSeconds?: number;
        expiresAt?: string;
      }>(
        "/api/v1/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            nationalIdentifier: form.nationalIdentifier,
            phoneNumber: form.phoneNumber,
            dateOfBirth: form.dateOfBirth ? form.dateOfBirth : null,
            gender: form.gender ? form.gender : null,
          }),
        },
        token
      );

      if (res.requiresPhoneVerify) {
        setOtpExpiresIn(res.expiresInSeconds && res.expiresInSeconds > 0 ? res.expiresInSeconds : DEFAULT_OTP_SECONDS);
        setOtpExpiresAt(res.expiresAt ?? "");
        setOtpResetKey((k) => k + 1);
        setOtpExpired(false);
        setOtpCode("");
        setOtpError("");
        setShowOtpModal(true);
        setSuccess(res.message);
      } else {
        setSuccess(res.message);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          setFields(err.fields);
        } else {
          setError(err.message);
        }
      } else {
        setError("Profil kaydedilirken sistemsel bir hata oluştu.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (!oldPassword || !newPassword) {
      setPassError("Mevcut ve yeni şifre alanları boş bırakılamaz.");
      return;
    }

    setSaving(true);
    setPassError("");
    setPassSuccess("");

    try {
      await api(
        "/api/v1/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            nationalIdentifier: form.nationalIdentifier,
            phoneNumber: form.phoneNumber,
            dateOfBirth: form.dateOfBirth ? form.dateOfBirth : null,
            gender: form.gender ? form.gender : null,
            oldPassword,
            newPassword,
          }),
        },
        token
      );

      setPassSuccess("Şifreniz başarıyla değiştirildi.");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setPassError(err instanceof ApiError ? err.message : "Şifre değiştirilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (!otpCode.trim()) {
      setOtpError("Lütfen doğrulama kodunu girin.");
      return;
    }

    setVerifyingOtp(true);
    setOtpError("");

    try {
      await api(
        "/api/v1/profile/verify",
        {
          method: "POST",
          body: JSON.stringify({ code: otpCode }),
        },
        token
      );

      setShowOtpModal(false);
      setOtpCode("");
      setSuccess("Telefon numaranız başarıyla güncellendi ve doğrulandı.");
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : "Doğrulama kodu hatalı.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Profil bilgileri yükleniyor...</div>;
  }

  return (
    <div className="grid gap-6 max-w-4xl w-full mx-auto">
      {error ? <FormAlert title="Hata" message={error} /> : null}
              {success ? (
                <MessageModal title="Başarılı" message={success} variant="success" onClose={() => setSuccess("")} />
              ) : null}

      <div className="flex flex-col gap-6">
        {/* Personal Details Card */}
        <Card className="large-form shadow-md border-slate-200">
          <form onSubmit={handleProfileSubmit} noValidate>
            <CardHeader>
              <CardTitle>Kişisel Bilgiler</CardTitle>
              <CardDescription>
                Ad, soyad, e-posta, T.C. Kimlik numarası ve iletişim bilgilerinizi buradan güncelleyebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextInput
                id="firstName"
                label="Ad"
                value={form.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                error={fields.firstName}
              />
              <TextInput
                id="lastName"
                label="Soyad"
                value={form.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                error={fields.lastName}
              />
              <TextInput
                id="email"
                label="E-posta Adresi"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                error={fields.email}
              />
              <TextInput
                id="nationalIdentifier"
                label="T.C. Kimlik No"
                value={form.nationalIdentifier}
                onChange={(e) => updateField("nationalIdentifier", e.target.value)}
                error={fields.nationalIdentifier}
              />
              <TextInput
                id="phoneNumber"
                label="Telefon Numarası"
                hint="Değiştirildiğinde SMS doğrulaması gerekecektir."
                value={form.phoneNumber}
                onChange={(e) => updateField("phoneNumber", e.target.value)}
                error={fields.phoneNumber}
              />
              <FormSelect
                id="gender"
                label="Cinsiyet"
                value={form.gender ? String(form.gender) : ""}
                onChange={(e) => updateField("gender", Number(e.target.value))}
                error={fields.gender}
                placeholder="Seçiniz"
                options={[
                  { value: "1", label: "Erkek" },
                  { value: "2", label: "Kadın" },
                ]}
              />
              <BirthDateSelect
                value={form.dateOfBirth}
                onChange={(iso) => updateField("dateOfBirth", iso)}
                error={fields.dateOfBirth}
                fieldClassName="sm:col-span-2"
              />
            </CardContent>
            <CardFooter className="border-t flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Bilgileri Kaydet"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Password Card */}
        <Card className="large-form shadow-md border-slate-200">
          <form onSubmit={handlePasswordSubmit} noValidate>
            <CardHeader>
              <CardTitle>Şifre İşlemleri</CardTitle>
              <CardDescription>Güvenliğiniz için şifrenizi düzenli aralıklarla güncelleyin.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {passError ? (
                <MessageModal title="Şifre hatası" message={passError} variant="destructive" onClose={() => setPassError("")} />
              ) : null}
              {passSuccess ? (
                <MessageModal title="Başarılı" message={passSuccess} variant="success" onClose={() => setPassSuccess("")} />
              ) : null}

              <PasswordInput
                id="oldPassword"
                label="Mevcut Şifre"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
              <PasswordInput
                id="newPassword"
                label="Yeni Şifre"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </CardContent>
            <CardFooter className="border-t flex justify-end">
              <Button type="submit" variant="secondary" disabled={saving}>
                {saving ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md large-form shadow-2xl border-slate-200">
            <form onSubmit={handleVerifyOtp} noValidate>
              <CardHeader>
                <CardTitle>SMS Doğrulama</CardTitle>
                <CardDescription>
                  Lütfen yeni telefon numaranıza gönderilen 6 haneli güvenlik doğrulama kodunu girin.
                  Kod sınırlı süre geçerlidir.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {otpError ? <p className="text-sm text-destructive font-medium">{otpError}</p> : null}

                <OtpExpiryBanner
                  expiresInSeconds={otpExpiresIn}
                  expiresAt={otpExpiresAt || undefined}
                  resetKey={otpResetKey}
                  onExpired={() => setOtpExpired(true)}
                />

                <FormField id="otpCode" label="Doğrulama Kodu">
                  <input
                    id="otpCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    disabled={otpExpired}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-xl font-bold tracking-widest placeholder:text-muted-foreground placeholder:tracking-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                </FormField>
              </CardContent>
              <CardFooter className="border-t flex gap-2 justify-end">
                <Button type="submit" disabled={verifyingOtp || otpExpired}>
                  {verifyingOtp ? "Doğrulanıyor..." : "Numarayı Doğrula"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowOtpModal(false)}>
                  İptal
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
