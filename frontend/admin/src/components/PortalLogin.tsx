"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearAuth, setToken, setUser, type AuthUser } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { portalHome, roleAllowedForPortal } from "@/lib/auth";
import { hasErrors, validateLogin, type FieldErrors } from "@/lib/validation";
import { AuthShell } from "@/components/AuthShell";
import { FormAlert, FormField } from "@/components/FormField";

type LoginResult = {
  accessToken: string;
  user?: AuthUser;
};

export function PortalLogin() {
  const router = useRouter();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    clearAuth();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    const local = validateLogin({
      nationalIdentifier: nationalId,
      password,
    });
    if (!password.trim()) {
      local.password = "Şifre zorunludur.";
    }
    setFields(local);
    if (hasErrors(local)) return;

    setLoading(true);
    try {
      const result = await api<LoginResult>(API.auth.login, {
        method: "POST",
        body: JSON.stringify({
          nationalIdentifier: nationalId.trim(),
          password,
        }),
      });

      const role = result.user?.role;
      if (!result.user || !roleAllowedForPortal(role)) {
        clearAuth();
        setFormError("Bu hesap yönetim paneline erişemez. Admin yetkisi gerekir.");
        return;
      }

      setToken(result.accessToken);
      setUser(result.user);
      router.replace(portalHome());
    } catch (err) {
      clearAuth();
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length) setFields(err.fields);
        setFormError(err.message);
      } else {
        setFormError("Giriş başarısız. TC Kimlik No ve şifrenizi kontrol edin.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="card w-full">
        <header>
          <h2>Yönetim girişi</h2>
          <p>Yönetim paneline erişmek için TC Kimlik No ve şifrenizi girin.</p>
        </header>
        <section>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {formError ? <FormAlert title="Giriş yapılamadı" message={formError} /> : null}
            <FormField id="nationalIdentifier" label="TC Kimlik No" error={fields.nationalIdentifier}>
              <input
                id="nationalIdentifier"
                name="username"
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
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <button type="submit" className="btn w-full" disabled={loading}>
              {loading ? "Doğrulanıyor..." : "Şifre ile giriş yap"}
            </button>
          </form>
        </section>
      </div>
    </AuthShell>
  );
}
