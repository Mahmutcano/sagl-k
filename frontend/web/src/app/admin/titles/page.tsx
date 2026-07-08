"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken, getUser, isAdminRole, clearAuth } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, TextInput } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit2, Plus, Trash2, X } from "lucide-react";

type Title = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminTitlesPage() {
  const router = useRouter();
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function load(token: string) {
    return api<Title[]>(API.admin.titles, {}, token).then((data) => {
      setTitles(data ?? []);
    });
  }

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace(ROUTES.admin.login);
      return;
    }
    load(token)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Unvanlar yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  function handleOpenAdd() {
    setEditingId(null);
    setFormName("");
    setFormActive(true);
    setFormError("");
    setIsModalOpen(true);
  }

  function handleOpenEdit(t: Title) {
    setEditingId(t.id);
    setFormName(t.name);
    setFormActive(t.isActive);
    setFormError("");
    setIsModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (!formName.trim()) {
      setFormError("Unvan adı boş olamaz.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await api(
          API.admin.titleUpdate(editingId),
          {
            method: "PUT",
            body: JSON.stringify({ name: formName.trim(), isActive: formActive }),
          },
          token
        );
        setSuccess("Unvan başarıyla güncellendi.");
      } else {
        await api(
          API.admin.titles,
          {
            method: "POST",
            body: JSON.stringify({ name: formName.trim() }),
          },
          token
        );
        setSuccess("Unvan başarıyla oluşturuldu.");
      }
      setIsModalOpen(false);
      await load(token);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "İşlem başarısız.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const token = getToken();
    if (!token) return;
    if (!confirm("Bu unvan tanımını silmek istediğinize emin misiniz?")) return;

    setError("");
    setSuccess("");
    try {
      await api(API.admin.titleUpdate(id), { method: "DELETE" }, token);
      setSuccess("Unvan silindi.");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unvan silinemedi.");
    }
  }

  return (
    <AdminAppShell title="Unvan Tanımları" description="Hekimler için akademik/mesleki unvan listesi yönetimi">
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {success ? (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-4 text-sm font-semibold mb-6 flex justify-between items-center shadow-sm">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <Card className="shadow-premium border-slate-200/80 bg-white/95 rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-5 px-6">
          <div>
            <CardTitle className="text-base text-slate-800 font-bold">Unvan Listesi</CardTitle>
            <CardDescription className="text-xs">Sistemdeki doktorların seçim yapabileceği tüm unvanlar</CardDescription>
          </div>
          <Button onClick={handleOpenAdd} size="sm" className="gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            Yeni Unvan Ekle
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : titles.length === 0 ? (
            <div className="p-16 text-center text-slate-500">Kayıtlı unvan bulunamadı.</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unvan Adı</TableHead>
                  <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Durum</TableHead>
                  <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Oluşturulma</TableHead>
                  <TableHead className="px-6 py-3 text-right print:hidden"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titles.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-6 py-4 font-semibold text-slate-800">{t.name}</TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant={t.isActive ? "default" : "secondary"}>
                        {t.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs text-slate-500 font-mono">
                      {new Date(t.createdAt).toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right print:hidden">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(t)} className="h-8 w-8 p-0 text-slate-500 hover:text-primary">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="h-8 w-8 p-0 text-slate-500 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-slate-200 bg-white">
            <form onSubmit={handleSave}>
              <CardHeader className="relative border-b pb-4">
                <CardTitle className="text-base text-slate-800 font-bold">
                  {editingId ? "Unvanı Düzenle" : "Yeni Unvan Tanımla"}
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-4 p-1 rounded-full"
                  onClick={() => setIsModalOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>

              <CardContent className="pt-6 flex flex-col gap-4">
                {formError ? <FormAlert title="Hata" message={formError} /> : null}

                <TextInput
                  id="name"
                  label="Unvan Adı"
                  placeholder="Örn: Prof. Dr. veya Uzm. Dr."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />

                {editingId && (
                  <div className="flex items-center space-x-2.5 py-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer h-4 w-4"
                    />
                    <label htmlFor="isActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      Bu unvan aktif/seçilebilir durumda
                    </label>
                  </div>
                )}
              </CardContent>

              <CardFooter className="border-t pt-4 flex gap-2 justify-end bg-slate-50/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={saving}>
                  İptal
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </AdminAppShell>
  );
}
