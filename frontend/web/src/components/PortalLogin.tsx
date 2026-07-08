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
import { LogIn, ArrowRight, Home } from "lucide-react";

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
    subtitle: "Başvurularınızı görüntülemek ve yeni başvuru oluşturmak için giriş yapın.",
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
      <div className="flex w-full flex-col gap-3">
        <Card className="w-full border-slate-200/60 shadow-premium-lg bg-card/85 backdrop-blur-md rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1.5 pb-4 pt-6 px-6">
            <CardTitle className="text-xl font-bold tracking-tight text-center">{cfg.title}</CardTitle>
            <CardDescription className="text-muted-foreground text-xs text-center">{cfg.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="pb-4 px-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {formError ? (
                <FormAlert
                  title="Giriş yapılamadı"
                  message={formError}
                />
              ) : null}
              
              <FormField id="nationalIdentifier" label="TC Kimlik No" error={fields.nationalIdentifier}>
                <Input
                  id="nationalIdentifier"
                  inputMode="numeric"
                  autoComplete="username"
                  maxLength={11}
                  required
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className="h-10 border-slate-200 focus-visible:ring-primary focus-visible:border-primary"
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
                  className="h-10 border-slate-200 focus-visible:ring-primary focus-visible:border-primary"
                  placeholder="••••••••"
                />
              </FormField>

              {area === "patient" ? (
                <div className="text-right -mt-2">
                  <Button variant="link" size="sm" className="h-auto px-0 text-xs text-muted-foreground hover:text-primary transition-colors" asChild>
                    <Link href={ROUTES.patient.forgotPassword}>Şifremi unuttum</Link>
                  </Button>
                </div>
              ) : null}

              <Button type="submit" className="w-full h-10 gap-2 text-sm mt-1 shadow-sm hover:shadow-md transition-all" disabled={loading}>
                {loading ? "Doğrulanıyor..." : (
                  <>
                    Giriş Yap
                    <LogIn className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col items-center gap-3 border-t border-slate-100/80 bg-slate-50/40 py-4 px-6">
            {area === "patient" ? (
              <p className="text-muted-foreground text-center text-xs">
                Henüz hesabınız yok mu?{" "}
                <Link
                  href={ROUTES.patient.register}
                  className="text-primary font-semibold underline-offset-4 hover:underline"
                >
                  Kayıt olun
                </Link>
              </p>
            ) : (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs gap-1.5" asChild>
                <Link href={ROUTES.home}>
                  <Home className="h-3.5 w-3.5" />
                  Ana sayfa
                </Link>
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Secondary Switch Link - Compact text link below the card */}
        <div className="text-center mt-1">
          {area === "patient" ? (
            <p className="text-xs text-muted-foreground">
              Sağlık personeli misiniz?{" "}
              <Link href={ROUTES.doctor.login} className="text-primary font-medium hover:underline inline-flex items-center gap-0.5">
                Doktor Girişi <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          ) : area === "doctor" ? (
            <p className="text-xs text-muted-foreground">
              Hasta girişi mi yapmak istiyorsunuz?{" "}
              <Link href={ROUTES.patient.login} className="text-primary font-medium hover:underline inline-flex items-center gap-0.5">
                Hasta Girişi <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          ) : area === "admin" ? (
            <Link href={loginForArea("doctor")} className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-0.5">
              Doktor Girişi <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>
    </AuthShell>
  );
}
