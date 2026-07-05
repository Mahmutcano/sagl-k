"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, persistAuth, type AuthUser } from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  homeForArea,
  loginForArea,
  roleAllowedForArea,
  type AppArea,
} from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { hasErrors, validateLogin, type FieldErrors } from "@/lib/validation";
import { AuthShell } from "@/components/AuthShell";
import { FormAlert, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type LoginResult = { accessToken: string; refreshToken?: string; user?: AuthUser };

const CONFIG: Record<
  AppArea,
  {
    badge: string;
    title: string;
    subtitle: string;
    roleError: string;
    forceFresh?: boolean;
  }
> = {
  patient: {
    badge: "Hasta",
    title: "Hasta girişi",
    subtitle: "Başvurularınızı görüntülemek ve yeni başvuru oluşturmak için giriş yapın.",
    roleError: "Bu giriş yalnızca hasta hesapları içindir.",
  },
  doctor: {
    badge: "Personel",
    title: "Personel girişi",
    subtitle: "Doktor veya hemşire hesabınızla size atanan başvuruları yönetin.",
    roleError: "Bu giriş yalnızca doktor veya hemşire hesapları içindir.",
    forceFresh: true,
  },
  admin: {
    badge: "Yönetim",
    title: "Yönetim girişi",
    subtitle: "Kurum yönetimi, ödemeler ve operasyonel panel için giriş yapın.",
    roleError: "Bu hesap yönetim paneline erişemez. Admin yetkisi gerekir.",
    forceFresh: true,
  },
};

function StaffPortalCard() {
  return (
    <Card className="border-dashed bg-muted/20 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Sağlık personeli</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Doktor panelinden size atanan başvuruları inceleyebilir ve rapor hazırlayabilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardFooter className="pt-0">
        <Button variant="outline" className="w-full" asChild>
          <Link href={ROUTES.doctor.login}>Doktor paneline giriş</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function PatientPortalHint() {
  return (
    <div className="rounded-xl border bg-muted/20 px-4 py-5 text-center">
      <p className="text-sm font-medium">Hasta hesabınız mı var?</p>
      <p className="text-muted-foreground mt-1 text-xs">
        Başvuru oluşturmak ve sürecinizi takip etmek için hasta portalına geçin.
      </p>
      <Button variant="link" size="sm" className="mt-2" asChild>
        <Link href={ROUTES.patient.login}>Hasta girişine geç</Link>
      </Button>
    </div>
  );
}

export function PortalLogin({ area }: { area: AppArea }) {
  const cfg = CONFIG[area];
  const router = useRouter();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cfg.forceFresh) clearAuth();
  }, [cfg.forceFresh]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const local = validateLogin({ nationalIdentifier: nationalId, password });
    if (!password.trim()) local.password = "Şifre zorunludur.";
    setFields(local);
    if (hasErrors(local)) return;

    setLoading(true);
    try {
      const result = await api<LoginResult>(API.auth.login, {
        method: "POST",
        body: JSON.stringify({ nationalIdentifier: nationalId.trim(), password }),
      });
      if (!result.user || !roleAllowedForArea(area, result.user.role)) {
        clearAuth();
        setFormError(cfg.roleError);
        return;
      }
      persistAuth(result);
      router.replace(homeForArea(area, result.user.role));
    } catch (err) {
      clearAuth();
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setFields(err.fields);
      }
      setFormError(err instanceof ApiError ? err.message : "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell badge={cfg.badge}>
      <div className="flex w-full flex-col gap-4">
        <Card className="w-full shadow-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">{cfg.title}</CardTitle>
            <CardDescription>{cfg.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {formError ? <FormAlert title="Giriş yapılamadı" message={formError} /> : null}
              <FormField id="nationalIdentifier" label="TC Kimlik No" error={fields.nationalIdentifier}>
                <Input
                  id="nationalIdentifier"
                  inputMode="numeric"
                  autoComplete="username"
                  maxLength={11}
                  required
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                />
              </FormField>
              <FormField id="password" label="Şifre" error={fields.password}>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormField>
              {area === "patient" ? (
                <div className="text-right -mt-1">
                  <Button variant="link" size="sm" className="h-auto px-0" asChild>
                    <Link href={ROUTES.patient.forgotPassword}>Şifremi unuttum</Link>
                  </Button>
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Doğrulanıyor..." : "Giriş yap"}
              </Button>
            </form>
          </CardContent>

          {area === "patient" ? (
            <CardFooter className="flex-col items-stretch gap-3 border-t pt-6">
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-muted-foreground shrink-0 text-xs font-medium">veya</span>
                <Separator className="flex-1" />
              </div>
              <p className="text-muted-foreground text-center text-sm">
                Henüz hesabınız yok mu?{" "}
                <Link
                  href={ROUTES.patient.register}
                  className="text-foreground font-medium underline-offset-4 hover:underline"
                >
                  Kayıt olun
                </Link>
              </p>
            </CardFooter>
          ) : (
            <CardFooter className="border-t pt-6">
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href={ROUTES.home}>← Ana sayfa</Link>
              </Button>
            </CardFooter>
          )}
        </Card>

        {area === "patient" ? <StaffPortalCard /> : null}
        {area === "doctor" ? <PatientPortalHint /> : null}
        {area === "admin" ? (
          <div className="text-center">
            <Button variant="link" size="sm" asChild>
              <Link href={loginForArea("doctor")}>Doktor girişi</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}
