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
  validateRefundAmount,
  validateRefundReason,
  type FieldErrors,
} from "@/lib/validation";
import { AdminAppShell } from "@/components/AdminAppShell";
import { FormAlert, TextInput } from "@/components/FormField";
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

type Payment = {
  id: string;
  applicationId: string;
  amount: number;
  currency: string;
  status: string;
};

export default function AdminRefundsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    paymentId: "",
    amount: "",
    reason: "",
  });

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !isAdminRole(user?.role)) {
      clearAuth();
      router.replace(ROUTES.admin.login);
      return;
    }
    api<Payment[]>(API.admin.payments, {}, token)
      .then((rows) => setPayments(rows ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const f: FieldErrors = {};
    if (!form.paymentId.trim()) f.paymentId = "Ödeme kimliği zorunludur.";
    const amount = Number(form.amount);
    const amountErr = validateRefundAmount(amount);
    if (amountErr) f.amount = amountErr;
    const reasonErr = validateRefundReason(form.reason);
    if (reasonErr) f.reason = reasonErr;
    setFields(f);
    if (hasErrors(f)) return;

    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const res = await api<{ applicationId: string; status: string }>(
        API.admin.refunds,
        {
          method: "POST",
          body: JSON.stringify({
            paymentId: form.paymentId,
            amount,
            reason: form.reason,
          }),
        },
        token
      );
      setMsg(`İade talebi oluşturuldu (${res.status}). Başvuru: ${res.applicationId}`);
      setForm({ paymentId: "", amount: "", reason: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İade oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  function pickPayment(p: Payment) {
    setForm((f) => ({
      ...f,
      paymentId: p.id,
      amount: String(p.amount),
    }));
  }

  return (
    <AdminAppShell title="İadeler" description="Ödeme iadesi oluştur">
      {error ? <FormAlert title="Hata" message={error} /> : null}
      {msg ? <FormAlert title="Başarılı" message={msg} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <form onSubmit={submit} noValidate>
            <CardHeader>
              <CardTitle>İade talebi</CardTitle>
              <CardDescription>Ödeme kimliği ve iade tutarını girin.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <TextInput
                id="paymentId"
                label="Ödeme kimliği (UUID)"
                value={form.paymentId}
                onChange={(e) => setForm((f) => ({ ...f, paymentId: e.target.value }))}
                error={fields.paymentId}
              />
              <TextInput
                id="amount"
                label="İade tutarı"
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                error={fields.amount}
              />
              <TextInput
                id="reason"
                label="Gerekçe"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                error={fields.reason}
              />
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={saving}>
                {saving ? "Gönderiliyor..." : "İade oluştur"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Son ödemeler</CardTitle>
            <CardDescription>Seçmek için satıra tıklayın</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : payments.length === 0 ? (
              <p className="text-muted-foreground text-sm">Ödeme kaydı yok.</p>
            ) : (
              <ul className="grid gap-2">
                {payments.slice(0, 20).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-muted"
                      onClick={() => pickPayment(p)}
                    >
                      <span className="font-medium">
                        {p.amount.toLocaleString("tr-TR")} {p.currency}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {p.id} · {p.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminAppShell>
  );
}
