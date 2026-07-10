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
import { PhoneNumberField } from "@/components/PhoneNumberField";
import { MessageModal } from "@/components/MessageModal";
import { OtpExpiryBanner, DEFAULT_OTP_SECONDS } from "@/components/OtpExpiryBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DEFAULT_PHONE_COUNTRY, normalizeNationalNumber } from "@/lib/phone";
import { type FieldErrors } from "@/lib/validation";

type ProfileData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  patientNumber?: string;
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
    phoneCountryCode: DEFAULT_PHONE_COUNTRY.dial,
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
          phoneCountryCode: data.phoneCountryCode || DEFAULT_PHONE_COUNTRY.dial,
          phoneNumber: normalizeNationalNumber(
            data.phoneNumber || "",
            data.phoneCountryCode || DEFAULT_PHONE_COUNTRY.dial
          ),
          patientNumber: data.patientNumber || "",
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
            phoneCountryCode: form.phoneCountryCode,
            phoneNumber: normalizeNationalNumber(form.phoneNumber, form.phoneCountryCode),
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
        <Card className=" ">
          <form onSubmit={handleProfileSubmit} noValidate>
            <CardHeader>
              <CardTitle>Kişisel Bilgiler</CardTitle>
              <CardDescription>
                Ad, soyad, e-posta, T.C. Kimlik numarası ve iletişim bilgilerinizi buradan güncelleyebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {form.patientNumber ? (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Hasta No: </span>
                  <span className="font-mono font-semibold tracking-wide">{form.patientNumber}</span>
                </div>
              ) : null}
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
              <PhoneNumberField
                countryDial={form.phoneCountryCode}
                nationalNumber={form.phoneNumber}
                onCountryChange={(dial) => updateField("phoneCountryCode", dial)}
                onNationalChange={(n) => updateField("phoneNumber", n)}
                error={fields.phoneNumber}
                hint="Değiştirildiğinde SMS doğrulaması gerekecektir."
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
            <CardFooter className="mt-2 flex justify-end border-t pt-4 sm:mt-4">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? "Kaydediliyor..." : "Bilgileri Kaydet"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Password Card */}
        <Card className=" ">
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
            <CardFooter className="mt-2 flex justify-end border-t pt-4 sm:mt-4">
              <Button type="submit" variant="secondary" disabled={saving} className="w-full sm:w-auto">
                {saving ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <Dialog open={showOtpModal} onOpenChange={(open) => !open && setShowOtpModal(false)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <form onSubmit={handleVerifyOtp} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>SMS Doğrulama</DialogTitle>
              <DialogDescription>
                Lütfen yeni telefon numaranıza gönderilen 6 haneli güvenlik doğrulama kodunu girin.
                Kod sınırlı süre geçerlidir.
              </DialogDescription>
            </DialogHeader>

            {otpError ? <p className="text-sm font-medium text-destructive">{otpError}</p> : null}

            <OtpExpiryBanner
              expiresInSeconds={otpExpiresIn}
              expiresAt={otpExpiresAt || undefined}
              resetKey={otpResetKey}
              onExpired={() => setOtpExpired(true)}
            />

            <FormField id="otpCode" label="Doğrulama Kodu">
              <Input
                id="otpCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                disabled={otpExpired}
                className="text-center text-xl font-bold tracking-widest"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              />
            </FormField>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => setShowOtpModal(false)}>
                İptal
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={verifyingOtp || otpExpired}>
                {verifyingOtp ? "Doğrulanıyor..." : "Numarayı Doğrula"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
