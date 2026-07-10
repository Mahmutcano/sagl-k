"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { ApiError, api } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { requireSession } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { FormAlert, FormSelect } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type SmsLog = {
  id: string;
  purpose: string;
  phoneE164: string;
  phoneCountryCode: string;
  phoneNumber: string;
  otpCode: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  errorMessage: string;
  createdAt: string;
};

export default function AdminSmsLogsPage() {
  const router = useRouter();
  const [items, setItems] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [purpose, setPurpose] = useState("");

  function load() {
    const session = requireSession("admin");
    if (!session) {
      router.replace(ROUTES.admin.login);
      return;
    }
    setLoading(true);
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (purpose) q.set("purpose", purpose);
    api<SmsLog[]>(`${API.admin.smsOtpLogs}?${q}`, {}, session.token)
      .then((rows) => setItems(rows ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Yüklenemedi."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, purpose]);

  return (
    <AdminAppShell
      title="SMS Kod Logları"
      description="Gönderilen doğrulama SMS’leri: kod, alıcı, isim soyisim ve gönderim durumu."
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      <form
        className="mb-4 flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold">Arama</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, telefon, kod, e-posta..."
          />
        </div>
        <FormSelect
          id="purpose"
          label="Amaç"
          value={purpose || undefined}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Tümü"
          options={[
            { value: "register", label: "Kayıt" },
            { value: "forgot_password", label: "Şifre sıfırlama" },
            { value: "change_phone", label: "Telefon değişikliği" },
          ]}
        />
        <Button type="submit">Ara</Button>
      </form>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">SMS logu yok.</Card>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Tarih</th>
                <th className="p-3">Kişi</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Kod</th>
                <th className="p-3">Amaç</th>
                <th className="p-3">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">
                      {[item.firstName, item.lastName].filter(Boolean).join(" ") || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.email || "—"}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {item.phoneE164 || `${item.phoneCountryCode}${item.phoneNumber}`}
                  </td>
                  <td className="p-3">
                    <span className="rounded bg-amber-50 px-2 py-1 font-mono text-sm font-bold tracking-widest text-amber-950">
                      {item.otpCode || "—"}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{item.purpose}</td>
                  <td className="p-3">
                    <Badge variant={item.status === "sent" ? "default" : "destructive"}>
                      {item.status === "sent" ? "Gönderildi" : "Başarısız"}
                    </Badge>
                    {item.errorMessage ? (
                      <div className="mt-1 max-w-[12rem] truncate text-[10px] text-destructive">
                        {item.errorMessage}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminAppShell>
  );
}
