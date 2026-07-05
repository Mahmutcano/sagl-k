"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  api,
  clearAuth,
  getToken,
  getUser,
  isAdminRole,
} from "@/lib/api";
import { API } from "@/lib/endpoints";
import {
  hasErrors,
  validateHospitalCode,
  validateHospitalName,
  type FieldErrors,
} from "@/lib/validation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, TextInput } from "@/components/FormField";
import Link from "next/link";
import { STATUS_LABELS, statusVariant, applicationDisplayNumber } from "@/lib/application";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AppRow = {
  applicationId: string;
  statusCode: number;
  patientName: string;
  applicationNumber?: string;
  ecommerceNumber?: string;
};

type Hospital = {
  id: string;
  name: string;
  code: string;
  targetInstitution: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [erciyesHealth, setErciyesHealth] = useState<{
    mode: string;
    healthy: boolean;
    targetInstitution: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [hospitalForm, setHospitalForm] = useState({
    code: "",
    name: "",
    targetInstitution: 1,
  });
  const [hospitalFields, setHospitalFields] = useState<FieldErrors>({});
  const [hospitalMsg, setHospitalMsg] = useState("");
  const [hospitalOk, setHospitalOk] = useState(false);
  const [saving, setSaving] = useState(false);

  function load(token: string) {
    return Promise.all([
      api<AppRow[]>(API.admin.applications, {}, token),
      api<Hospital[]>(API.admin.hospitals, {}, token),
      api<{ mode: string; healthy: boolean; targetInstitution: number }>(
        API.admin.erciyesHealth,
        {},
        token
      ).catch(() => null),
    ]).then(([a, h, e]) => {
      setApps(a ?? []);
      setHospitals(h ?? []);
      setErciyesHealth(e);
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
      .catch((err) => {
        if (
          err instanceof ApiError &&
          (err.code === "AUTH001" || err.code === "AUTH002" || err.code === "AUTH004")
        ) {
          clearAuth();
          router.replace(ROUTES.admin.login);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function createHospital(e: React.FormEvent) {
    e.preventDefault();
    setHospitalMsg("");
    setHospitalOk(false);
    const fields: FieldErrors = {};
    const codeErr = validateHospitalCode(hospitalForm.code);
    if (codeErr) fields.code = codeErr;
    const nameErr = validateHospitalName(hospitalForm.name);
    if (nameErr) fields.name = nameErr;
    if (hospitalForm.targetInstitution < 1 || hospitalForm.targetInstitution > 99) {
      fields.targetInstitution = "Hedef kurum kodu 1–99 arasında olmalıdır.";
    }
    setHospitalFields(fields);
    if (hasErrors(fields)) return;

    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await api(
        API.admin.hospitals,
        { method: "POST", body: JSON.stringify(hospitalForm) },
        token
      );
      setHospitalForm({ code: "", name: "", targetInstitution: 1 });
      setHospitalMsg("Hastane başarıyla oluşturuldu.");
      setHospitalOk(true);
      await load(token);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length) setHospitalFields(err.fields);
        setHospitalMsg(err.message);
      } else {
        setHospitalMsg("Hastane oluşturulamadı.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminAppShell
      title="Yönetim paneli"
      description="Hastaneler, başvurular ve operasyonel özet"
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hastaneler</CardTitle>
            <CardDescription>Kayıtlı kurum</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{loading ? "—" : hospitals.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Başvurular</CardTitle>
            <CardDescription>Son kayıtlar</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{loading ? "—" : apps.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Erciyes HIS</CardTitle>
            <CardDescription>Web servisi</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {loading || !erciyesHealth ? (
              <Badge variant="outline">—</Badge>
            ) : (
              <>
                <Badge variant={erciyesHealth.healthy ? "default" : "destructive"}>
                  {erciyesHealth.healthy ? "Bağlı" : "Erişilemiyor"}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  mod: {erciyesHealth.mode} · kurum: {erciyesHealth.targetInstitution}
                </span>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hastaneler</CardTitle>
            <CardDescription>Sistemde tanımlı kurumlar</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : hospitals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                  <CardHeader className="p-0">
                    <CardTitle className="text-base">Hastane yok</CardTitle>
                    <CardDescription>Sağdaki formdan ilk kurumu ekleyin.</CardDescription>
                  </CardHeader>
                </CardContent>
              </Card>
            ) : (
              <ul className="grid gap-2">
                {hospitals.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{h.name}</span>
                    <Badge variant="secondary">{h.code}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <form onSubmit={createHospital} noValidate>
            <CardHeader>
              <CardTitle>Hastane ekle</CardTitle>
              <CardDescription>Alanlar istemci ve sunucuda doğrulanır.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {hospitalMsg ? (
                <FormAlert
                  title={hospitalOk ? "Başarılı" : "Uyarı"}
                  message={hospitalMsg}
                  variant={hospitalOk ? "default" : "destructive"}
                />
              ) : null}
              <TextInput
                id="code"
                label="Kod"
                hint="2–32 karakter, benzersiz"
                placeholder="ORN-01"
                value={hospitalForm.code}
                onChange={(e) => setHospitalForm((f) => ({ ...f, code: e.target.value }))}
                error={hospitalFields.code}
              />
              <TextInput
                id="name"
                label="Ad"
                placeholder="Örnek Hastanesi"
                value={hospitalForm.name}
                onChange={(e) => setHospitalForm((f) => ({ ...f, name: e.target.value }))}
                error={hospitalFields.name}
              />
              <TextInput
                id="targetInstitution"
                label="Hedef kurum"
                type="number"
                min={1}
                max={99}
                hint="1–99 arası kurum kodu"
                value={String(hospitalForm.targetInstitution)}
                onChange={(e) =>
                  setHospitalForm((f) => ({
                    ...f,
                    targetInstitution: Number(e.target.value),
                  }))
                }
                error={hospitalFields.targetInstitution}
              />
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Hastaneyi kaydet"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Başvurular</CardTitle>
          <CardDescription>Son 100 başvuru kaydı</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : apps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <CardHeader className="p-0">
                  <CardTitle className="text-base">Başvuru yok</CardTitle>
                  <CardDescription>Hasta başvuruları burada listelenir.</CardDescription>
                </CardHeader>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hasta</TableHead>
                  <TableHead>Başvuru no</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.applicationId}>
                    <TableCell>
                      <Link
                        href={ROUTES.admin.application(a.applicationId)}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {a.patientName}
                      </Link>
                    </TableCell>
                    <TableCell>{applicationDisplayNumber(a)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(a.statusCode)}>
                        {STATUS_LABELS[a.statusCode] ?? a.statusCode}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminAppShell>
  );
}
