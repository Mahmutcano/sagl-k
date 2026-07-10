"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { ApiError, api, getToken } from "@/lib/api";
import { requireSession, roleLabel } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  FormAlert,
  FormSelect,
  BirthDateSelect,
  TextInput,
} from "@/components/FormField";
import { PasswordInput } from "@/components/PasswordInput";
import type { FieldErrors } from "@/lib/validation";

type UserListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  nationalIdentifier: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type UserDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  nationalIdentifier: string;
  dateOfBirth: string | null;
  gender: number | null;
  role: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserDetail | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    nationalIdentifier: "",
    dateOfBirth: "",
    gender: 0,
    role: "",
    isActive: true,
    password: "",
  });
  const [editFields, setEditFields] = useState<FieldErrors>({});
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const session = requireSession("admin");
    if (!session) {
      router.replace(ROUTES.admin.login);
      return;
    }
    setLoading(true);
    setError("");
    api<{ items: UserListItem[] }>("/api/v1/admin/users", {}, session.token)
      .then((res) => setUsers(res?.items ?? []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Kullanıcılar yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOpenEdit(userID: string) {
    const token = getToken();
    if (!token) return;

    setEditError("");
    setEditFields({});

    try {
      const detail = await api<UserDetail>(`/api/v1/admin/users/${userID}`, {}, token);
      
      // Find active state from list
      const listItem = users.find((u) => u.id === userID);

      setEditingUser(detail);
      setEditForm({
        firstName: detail.firstName,
        lastName: detail.lastName,
        email: detail.email,
        phoneNumber: detail.phoneNumber,
        nationalIdentifier: detail.nationalIdentifier || "",
        dateOfBirth: detail.dateOfBirth || "",
        gender: detail.gender || 0,
        role: detail.role,
        isActive: listItem ? listItem.isActive : true,
        password: "",
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kullanıcı detayları alınamadı.");
    }
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    const token = getToken();
    if (!token) return;

    setSaving(true);
    setEditError("");
    setEditFields({});

    try {
      await api(
        `/api/v1/admin/users/${editingUser.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            firstName: editForm.firstName,
            lastName: editForm.lastName,
            email: editForm.email,
            phoneNumber: editForm.phoneNumber,
            nationalIdentifier: editForm.nationalIdentifier,
            dateOfBirth: editForm.dateOfBirth ? editForm.dateOfBirth : null,
            gender: editForm.gender ? editForm.gender : null,
            role: editForm.role,
            isActive: editForm.isActive,
            password: editForm.password || undefined,
          }),
        },
        token
      );

      setEditingUser(null);
      setSuccess("Kullanıcı bilgileri başarıyla güncellendi.");
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          setEditFields(err.fields);
        } else {
          setEditError(err.message);
        }
      } else {
        setEditError("Kullanıcı güncellenirken bir hata oluştu.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminAppShell
      title="Sistem Kullanıcıları"
      description="Kayıtlı hastaların, doktorların ve hemşirelerin bilgilerini güncelleyin veya hesaplarını aktifleştirin/pasifleştirin."
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {success ? (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg p-4 text-sm font-medium">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Kullanıcı listesi yükleniyor...</div>
      ) : users.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Sistemde henüz kayıtlı kullanıcı yok.</Card>
      ) : (
        <div className="admin-table-scroll overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/40 font-medium text-muted-foreground">
                <th className="p-4">Ad Soyad</th>
                <th className="p-4">T.C. Kimlik No</th>
                <th className="p-4">E-posta</th>
                <th className="p-4">Telefon</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Durum</th>
                <th className="p-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-semibold text-foreground">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="p-4 font-mono text-xs">{u.nationalIdentifier || "-"}</td>
                  <td className="p-4">{u.email}</td>
                  <td className="p-4">{u.phoneNumber}</td>
                  <td className="p-4">
                    <Badge variant={u.role === "admin" ? "default" : u.role === "doctor" ? "secondary" : "outline"}>
                      {roleLabel(u.role)}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <Badge variant={u.isActive ? "default" : "destructive"}>
                      {u.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(u.id)} className="cursor-pointer">
                      Düzenle
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={handleSaveEdit} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Kullanıcı Bilgilerini Düzenle</DialogTitle>
              <DialogDescription>
                Yönetici yetkisiyle bu kullanıcının kişisel, iletişim ve yetki bilgilerini güncelliyorsunuz.
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[55vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
                {editError ? <div className="sm:col-span-2"><FormAlert title="Hata" message={editError} /></div> : null}

                <TextInput
                  id="edit-firstName"
                  label="Ad"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  error={editFields.firstName}
                />
                <TextInput
                  id="edit-lastName"
                  label="Soyad"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  error={editFields.lastName}
                />
                <TextInput
                  id="edit-email"
                  label="E-posta Adresi"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  error={editFields.email}
                />
                <TextInput
                  id="edit-nationalIdentifier"
                  label="T.C. Kimlik No"
                  value={editForm.nationalIdentifier}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, nationalIdentifier: e.target.value }))}
                  error={editFields.nationalIdentifier}
                />
                <TextInput
                  id="edit-phoneNumber"
                  label="Telefon Numarası"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  error={editFields.phoneNumber}
                />
                <FormSelect
                  id="edit-role"
                  label="Kullanıcı Rolü"
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                  error={editFields.role}
                  placeholder="Rol Seçiniz"
                  options={[
                    { value: "patient", label: "Hasta" },
                    { value: "doctor", label: "Doktor" },
                    { value: "nurse", label: "Hemşire (Sekreterya)" },
                    { value: "admin", label: "Yönetici" },
                  ]}
                />
                <FormSelect
                  id="edit-gender"
                  label="Cinsiyet"
                  value={editForm.gender ? String(editForm.gender) : ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, gender: Number(e.target.value) }))}
                  error={editFields.gender}
                  placeholder="Seçiniz"
                  options={[
                    { value: "1", label: "Erkek" },
                    { value: "2", label: "Kadın" },
                  ]}
                />
                <FormSelect
                  id="edit-isActive"
                  label="Hesap Durumu"
                  value={editForm.isActive ? "true" : "false"}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                  placeholder="Durum Seçiniz"
                  options={[
                    { value: "true", label: "Aktif (Sisteme girebilir)" },
                    { value: "false", label: "Pasif (Giriş engellenir)" },
                  ]}
                />
                <BirthDateSelect
                  value={editForm.dateOfBirth}
                  onChange={(iso) => setEditForm((prev) => ({ ...prev, dateOfBirth: iso }))}
                  error={editFields.dateOfBirth}
                  fieldClassName="sm:col-span-2"
                />

                <div className="sm:col-span-2 border-t pt-4 mt-2">
                  <h4 className="text-sm font-semibold mb-2">Şifre Değiştir (Admin Yetkisiyle)</h4>
                  <PasswordInput
                    id="edit-password"
                    label="Yeni Şifre"
                    hint="Boş bırakırsanız mevcut şifre korunur."
                    value={editForm.password}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                    error={editFields.password}
                  />
                </div>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => setEditingUser(null)}>
                İptal
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminAppShell>
  );
}
