"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, setToken, setUser, type AuthUser } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { portalHome, roleAllowedForPortal } from "@/lib/auth";
import { PATIENT_APP_URL } from "@/lib/urls";
import { hasErrors, validateLogin, type FieldErrors } from "@/lib/validation";
import { AuthShell } from "@/components/AuthShell";
import { FormAlert, FormField } from "@/components/FormField";

type LoginResult = { accessToken: string; user?: AuthUser };

export function PortalLogin({ forceFresh = true }: { forceFresh?: boolean }) {
  const router = useRouter();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (forceFresh) clearAuth();
  }, [forceFresh]);

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
      if (!result.user || !roleAllowedForPortal(result.user.role)) {
        clearAuth();
        setFormError("Bu giriş yalnızca doktor / hemşire hesapları içindir.");
        return;
      }
      setToken(result.accessToken);
      setUser(result.user);
      router.replace(portalHome());
    } catch (err) {
      clearAuth();
      setFormError(err instanceof ApiError ? err.message : "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="card w-full">
        <header>
          <h2>Doktor girişi</h2>
          <p>Değerlendirme kuyruğu ve rapor işlemleri için giriş yapın.</p>
        </header>
        <section>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {formError ? <FormAlert title="Giriş yapılamadı" message={formError} /> : null}
            <FormField id="nationalIdentifier" label="TC Kimlik No" error={fields.nationalIdentifier}>
              <input
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
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <button type="submit" className="btn w-full" disabled={loading}>
              {loading ? "Doğrulanıyor..." : "Giriş yap"}
            </button>
          </form>
        </section>
        <footer className="border-t flex justify-between gap-2">
          <a href={PATIENT_APP_URL} className="btn" data-variant="link" data-size="sm">
            Hasta portalı
          </a>
          <Link href="/" className="btn" data-variant="ghost" data-size="sm">
            Ana sayfa
          </Link>
        </footer>
      </div>
    </AuthShell>
  );
}
