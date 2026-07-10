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
import { LogIn, ArrowRight, Home, UserPlus } from "lucide-react";

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
    title: "Hasta Girişi",
    subtitle: "Başvuru yapmak veya başvurularınızı görmek için giriş yapın.",
    roleError: "Bu giriş yalnızca hasta hesapları içindir.",
  },
  doctor: {
    badge: "Personel",
    title: "Personel Girişi",
    subtitle: "Doktor veya hemşire hesabınızla size atanan başvuruları yönetin.",
    roleError: "Bu giriş yalnızca doktor veya hemşire hesapları içindir.",
    forceFresh: true,
  },
  admin: {
    badge: "Yönetim",
    title: "Yönetim Girişi",
    subtitle: "Kurum yönetimi, ödemeler ve operasyonel panel için giriş yapın.",
    roleError: "Bu hesap yönetim paneline erişemez. Admin yetkisi gerekir.",
    forceFresh: true,
  },
};

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
        <Card className="w-full overflow-hidden rounded-2xl border-slate-200/60 bg-card/85 shadow-premium-lg backdrop-blur-md">
          <CardHeader className="space-y-1.5 px-5 pb-4 pt-6 sm:px-6">
            <CardTitle className="text-center text-xl font-bold tracking-tight sm:text-2xl">
              {cfg.title}
            </CardTitle>
            <CardDescription className="text-center text-sm leading-relaxed">
              {cfg.subtitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6">
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
                  className="h-12 border-slate-200 bg-white text-base focus-visible:border-primary focus-visible:ring-primary sm:h-11 sm:text-sm"
                  placeholder="11 haneli TC kimlik numaranız"
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
                  className="h-12 border-slate-200 bg-white text-base focus-visible:border-primary focus-visible:ring-primary sm:h-11 sm:text-sm"
                  placeholder="••••••••"
                />
              </FormField>

              {(area === "patient" || area === "doctor") ? (
                <div className="-mt-1 text-right">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto min-h-11 px-0 text-sm text-muted-foreground hover:text-primary sm:min-h-0 sm:text-xs"
                    asChild
                  >
                    <Link href={ROUTES.patient.forgotPassword}>Şifremi unuttum</Link>
                  </Button>
                </div>
              ) : null}

              <Button
                type="submit"
                className="mt-1 h-12 w-full gap-2 text-base font-semibold shadow-sm transition-all hover:shadow-md sm:h-11 sm:text-sm"
                disabled={loading}
              >
                {loading ? (
                  "Doğrulanıyor..."
                ) : (
                  <>
                    Giriş Yap
                    <LogIn className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3 border-t border-slate-100/80 bg-slate-50/50 px-5 py-5 sm:px-6">
            {area === "patient" ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm font-medium text-slate-700">Hesabınız yok mu?</p>
                <Button
                  variant="outline"
                  className="h-12 w-full gap-2 text-base font-semibold sm:h-11 sm:text-sm"
                  asChild
                >
                  <Link href={ROUTES.patient.register}>
                    <UserPlus className="h-4 w-4" />
                    Kayıt ol
                  </Link>
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href={ROUTES.home}>
                  <Home className="h-3.5 w-3.5" />
                  Ana sayfa
                </Link>
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="px-1 pb-2 text-center">
          {area === "patient" ? (
            <p className="text-sm text-muted-foreground">
              Sağlık personeli misiniz?{" "}
              <Link
                href={ROUTES.doctor.login}
                className="inline-flex min-h-11 items-center gap-0.5 font-medium text-primary hover:underline sm:min-h-0"
              >
                Doktor girişi <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </p>
          ) : area === "doctor" ? (
            <p className="text-sm text-muted-foreground">
              Hasta girişi mi?{" "}
              <Link
                href={ROUTES.patient.login}
                className="inline-flex min-h-11 items-center gap-0.5 font-medium text-primary hover:underline sm:min-h-0"
              >
                Hasta girişi <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </p>
          ) : area === "admin" ? (
            <Link
              href={loginForArea("doctor")}
              className="inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-primary hover:underline sm:min-h-0"
            >
              Doktor girişi <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </AuthShell>
  );
}
