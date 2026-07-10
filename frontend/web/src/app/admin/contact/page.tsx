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

type ContactItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  createdAt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "Genel",
  complaint: "Şikayet",
  suggestion: "Öneri",
  support: "Destek",
};

export default function AdminContactPage() {
  const router = useRouter();
  const [items, setItems] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<ContactItem | null>(null);

  function load() {
    const session = requireSession("admin");
    if (!session) {
      router.replace(ROUTES.admin.login);
      return;
    }
    setLoading(true);
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (status) q.set("status", status);
    api<ContactItem[]>(`${API.admin.contactMessages}?${q}`, {}, session.token)
      .then((rows) => setItems(rows ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Yüklenemedi."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, status]);

  async function updateStatus(id: string, next: string) {
    const session = requireSession("admin");
    if (!session) return;
    try {
      await api(API.admin.contactMessageUpdate(id), {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      }, session.token);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: next } : i)));
      if (selected?.id === id) setSelected({ ...selected, status: next });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi.");
    }
  }

  return (
    <AdminAppShell
      title="İletişim / Şikayet / Öneri"
      description="Anasayfa iletişim formundan gelen mesajlar. E-posta da gönderilir; kayıtlar burada tutulur."
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
            placeholder="İsim, e-posta, konu..."
          />
        </div>
        <FormSelect
          id="status"
          label="Durum"
          value={status || undefined}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Tümü"
          options={[
            { value: "new", label: "Yeni" },
            { value: "read", label: "Okundu" },
            { value: "closed", label: "Kapalı" },
          ]}
        />
        <Button type="submit">Ara</Button>
      </form>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Mesaj yok.</Card>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Tarih</th>
                <th className="p-3">Gönderen</th>
                <th className="p-3">Konu</th>
                <th className="p-3">Kategori</th>
                <th className="p-3">Durum</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{item.fullName}</div>
                    <div className="text-xs text-muted-foreground">{item.email}</div>
                  </td>
                  <td className="p-3 max-w-[14rem] truncate">{item.subject}</td>
                  <td className="p-3">
                    <Badge variant="outline">{CATEGORY_LABEL[item.category] ?? item.category}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={item.status === "new" ? "default" : "secondary"}>
                      {item.status === "new" ? "Yeni" : item.status === "read" ? "Okundu" : "Kapalı"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(item)}>
                      Aç
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.subject}</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.fullName} · {selected.email}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Kapat
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => updateStatus(selected.id, "read")}>
                Okundu
              </Button>
              <Button size="sm" onClick={() => updateStatus(selected.id, "closed")}>
                Kapat / Arşivle
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </AdminAppShell>
  );
}
