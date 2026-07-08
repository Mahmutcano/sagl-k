"use client";

import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { type PaymentRequest, type PaymentReceipt, normalizePaymentResult, isPaymentSuccessful } from "@/lib/application";
import { FormAlert, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const PAYMENT_AMOUNT = 1500;

const PARAM_TEST_CARD = {
  cardHolder: "TEST KULLANICI",
  cardNumber: "4546711234567894",
  expiryMonth: "12",
  expiryYear: "26",
  cvv: "000",
};

type Props = {
  applicationId: string;
  token: string;
  onSuccess?: (receipt?: PaymentReceipt) => void;
  onError?: (message: string) => void;
};

export function ApplicationPaymentForm({ applicationId, token, onSuccess, onError }: Props) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [card, setCard] = useState({
    cardHolder: "",
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function fillTestCard() {
    setCard({ ...PARAM_TEST_CARD });
    setFieldErrors({});
    setError("");
  }

  function validatePaymentForm(): boolean {
    const f: Record<string, string> = {};
    if (!card.cardHolder.trim() || card.cardHolder.trim().length < 3) {
      f.cardHolder = "Kart üzerindeki isim en az 3 karakter olmalıdır.";
    }
    const digits = card.cardNumber.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) {
      f.cardNumber = "Geçerli bir kart numarası giriniz.";
    }
    const month = parseInt(card.expiryMonth, 10);
    if (!month || month < 1 || month > 12) {
      f.expiryMonth = "Ay 1–12 arasında olmalıdır.";
    }
    const year = parseInt(card.expiryYear, 10);
    if (!year || year < new Date().getFullYear() % 100) {
      f.expiryYear = "Geçerli bir yıl giriniz.";
    }
    const cvvDigits = card.cvv.replace(/\D/g, "");
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      f.cvv = "CVV 3 veya 4 haneli olmalıdır.";
    }
    setFieldErrors(f);
    return Object.keys(f).length === 0;
  }

  async function pay() {
    setPaying(true);
    setError("");
    setFieldErrors({});

    if (!validatePaymentForm()) {
      setPaying(false);
      return;
    }

    const body: PaymentRequest = {
      provider: "param",
      cardHolder: card.cardHolder.trim(),
      cardNumber: card.cardNumber.replace(/\s/g, ""),
      expiryMonth: parseInt(card.expiryMonth, 10),
      expiryYear: parseInt(card.expiryYear, 10),
      cvv: card.cvv.replace(/\D/g, ""),
    };

    try {
      const raw = await api<Record<string, unknown>>(
        API.applications.payment(applicationId),
        { method: "POST", body: JSON.stringify(body) },
        token
      );
      const res = normalizePaymentResult(raw);
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      if (isPaymentSuccessful(res.status)) {
        onSuccess?.(res.receipt);
      } else if (res.status) {
        setError(`Ödeme durumu: ${res.status}`);
        onError?.(`Ödeme durumu: ${res.status}`);
      } else {
        onSuccess?.(res.receipt);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "APP110") {
          onSuccess?.();
          return;
        }
        if (err.fields) {
          setFieldErrors(err.fields);
        }
      }
      const msg = err instanceof ApiError ? err.message : "Ödeme başarısız.";
      setError(msg);
      onError?.(msg);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <FormAlert title="Ödeme hatası" message={error} /> : null}
      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium text-foreground">Param ile güvenli ödeme</p>
        <p className="text-muted-foreground mt-1">
          Tutar:{" "}
          <span className="font-medium text-foreground">
            {PAYMENT_AMOUNT.toLocaleString("tr-TR")} TRY
          </span>
          {" · "}
          Ödeme sonrası fatura Bizim Hesap üzerinden otomatik oluşturulur.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Param test kartı:</span>
          <code className="rounded bg-background px-2 py-0.5 text-xs">
            {PARAM_TEST_CARD.cardNumber}
          </code>
          <span className="text-muted-foreground text-xs">12/26 · CVV 000</span>
          <Button type="button" variant="outline" size="sm" onClick={fillTestCard}>
            Test kartını doldur
          </Button>
        </div>
      </div>
      <FormField id="cardHolder" label="Kart üzerindeki isim" error={fieldErrors.cardHolder}>
        <Input
          id="cardHolder"
          autoComplete="cc-name"
          value={card.cardHolder}
          onChange={(e) => setCard((c) => ({ ...c, cardHolder: e.target.value }))}
        />
      </FormField>
      <FormField id="cardNumber" label="Kart numarası" error={fieldErrors.cardNumber}>
        <Input
          id="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
          value={card.cardNumber}
          onChange={(e) => setCard((c) => ({ ...c, cardNumber: e.target.value }))}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="expiryMonth" label="Ay (MM)" error={fieldErrors.expiryMonth}>
          <Input
            id="expiryMonth"
            inputMode="numeric"
            autoComplete="cc-exp-month"
            placeholder="MM"
            maxLength={2}
            value={card.expiryMonth}
            onChange={(e) => setCard((c) => ({ ...c, expiryMonth: e.target.value }))}
          />
        </FormField>
        <FormField id="expiryYear" label="Yıl (YY)" error={fieldErrors.expiryYear}>
          <Input
            id="expiryYear"
            inputMode="numeric"
            autoComplete="cc-exp-year"
            placeholder="YY"
            maxLength={2}
            value={card.expiryYear}
            onChange={(e) => setCard((c) => ({ ...c, expiryYear: e.target.value }))}
          />
        </FormField>
        <FormField id="cvv" label="CVV" error={fieldErrors.cvv}>
          <Input
            id="cvv"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="***"
            maxLength={4}
            value={card.cvv}
            onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value }))}
          />
        </FormField>
      </div>
      <Button type="button" disabled={paying} onClick={pay}>
        {paying ? "İşleniyor..." : "Param ile ödemeyi tamamla"}
      </Button>
    </div>
  );
}
