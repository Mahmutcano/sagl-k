"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { ApiError, api } from "@/lib/api";
import { API } from "@/lib/endpoints";
import { type PaymentReceipt, normalizePaymentResult, isPaymentSuccessful } from "@/lib/application";
import { FormAlert } from "@/components/FormField";
import { Button } from "@/components/ui/button";

export const PAYMENT_AMOUNT = 1500;

/** Official PAYTR Direct API test cards (also usable when iframe asks for card). */
export const PAYTR_TEST_CARDS = [
  { label: "Visa", holder: "PAYTR TEST", number: "4355 0843 5508 4358", expiry: "12/30", cvv: "000" },
  { label: "Mastercard", holder: "PAYTR TEST", number: "5406 6754 0667 5403", expiry: "12/30", cvv: "000" },
  { label: "Troy", holder: "PAYTR TEST", number: "9792 0303 9444 0796", expiry: "12/30", cvv: "000" },
] as const;

type TestCard = {
  label: string;
  holder: string;
  number: string;
  expiry: string;
  cvv: string;
  note?: string;
};

type TokenResponse = {
  status?: string;
  token?: string;
  iframeUrl?: string;
  merchantOid?: string;
  amount?: number;
  currency?: string;
  mock?: boolean;
  mode?: string;
  paymentId?: string;
  testCards?: TestCard[];
  receipt?: PaymentReceipt;
};

type Props = {
  applicationId: string;
  token: string;
  onSuccess?: (receipt?: PaymentReceipt) => void;
  onError?: (message: string) => void;
};

export function ApplicationPaymentForm({ applicationId, token, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [paytr, setPaytr] = useState<TokenResponse | null>(null);
  const [alreadyPaidReceipt, setAlreadyPaidReceipt] = useState<PaymentReceipt | null>(null);
  const started = useRef(false);

  const start = useCallback(async () => {
    setLoading(true);
    setError("");
    setAlreadyPaidReceipt(null);
    try {
      const raw = await api<TokenResponse>(
        API.applications.paytrToken(applicationId),
        { method: "POST", body: JSON.stringify({}) },
        token
      );
      if (raw.status === "paid") {
        // Ödeme ekranını atlamadan kullanıcıya durumu göster; onSuccess'i butonla tetikle.
        setPaytr(raw);
        setAlreadyPaidReceipt(normalizePaymentResult(raw as Record<string, unknown>).receipt ?? null);
        return;
      }
      setPaytr(raw);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Ödeme başlatılamadı.";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [applicationId, token, onError]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  async function completeMock() {
    if (!paytr?.merchantOid) return;
    setPaying(true);
    setError("");
    try {
      const raw = await api<Record<string, unknown>>(
        API.applications.paytrSimulate(applicationId),
        {
          method: "POST",
          body: JSON.stringify({ merchantOid: paytr.merchantOid }),
        },
        token
      );
      const res = normalizePaymentResult(raw);
      if (isPaymentSuccessful(res.status)) {
        onSuccess?.(res.receipt);
      } else {
        setError("Test ödemesi tamamlanamadı.");
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Test ödemesi başarısız.";
      setError(msg);
      onError?.(msg);
    } finally {
      setPaying(false);
    }
  }

  const amount = paytr?.amount ?? PAYMENT_AMOUNT;
  const isTestMode = paytr?.mode === "test" || (!!paytr?.testCards && paytr.testCards.length > 0);
  const cards: TestCard[] =
    paytr?.testCards?.length
      ? paytr.testCards
      : isTestMode
        ? PAYTR_TEST_CARDS.map((c) => ({ ...c }))
        : [];

  return (
    <div className="space-y-4">
      {error ? <FormAlert title="Ödeme hatası" message={error} /> : null}

      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <p className="font-medium">Ödenecek tutar</p>
        <p className="text-2xl font-semibold tracking-tight">
          {amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {paytr?.currency ?? "TRY"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Güvenli ödeme altyapısı: PAYTR</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Ödeme formu hazırlanıyor…</p>
      ) : null}

      {!loading && paytr?.status === "paid" ? (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Bu başvuru için ödeme zaten alınmış.</p>
          <p className="text-xs text-muted-foreground">
            Yeni bir ödeme gerekmiyor. Başvurunuz uzman hekim değerlendirmesinde.
          </p>
          <Button
            type="button"
            className="w-full"
            onClick={() => onSuccess?.(alreadyPaidReceipt ?? undefined)}
          >
            Başvuruya dön
          </Button>
        </div>
      ) : null}

      {!loading && paytr?.mock && paytr.status !== "paid" ? (
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            PAYTR mock modundasınız. Canlı iframe yerine test ödemesini simüle edebilirsiniz.
          </p>
          <Button type="button" className="w-full" disabled={paying} onClick={() => void completeMock()}>
            {paying ? "Tamamlanıyor…" : "Test ödemesini tamamla"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => void start()} disabled={paying}>
            Yeniden başlat
          </Button>
        </div>
      ) : null}

      {!loading && paytr && !paytr.mock && paytr.token && paytr.status !== "paid" ? (
        <div className="space-y-3">
          {cards.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm">
              <p className="font-semibold text-amber-950">PAYTR test kartları (stage / test_mode)</p>
              <p className="mt-1 text-xs text-amber-900/80">
                iFrame bazen kartı otomatik doldurur. İstenirse aşağıdaki kartlardan birini kullanın. CVV her zaman{" "}
                <span className="font-mono font-bold">000</span>. SKT gelecekte bir tarih olabilir (ör. 12/30).
              </p>
              <ul className="mt-3 space-y-2">
                {cards.map((c) => (
                  <li key={c.number} className="rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 font-mono text-xs text-amber-950">
                    <span className="font-sans font-semibold">{c.label}</span>
                    <br />
                    {c.number} · SKT {c.expiry} · CVV {c.cvv}
                    {c.note ? <span className="mt-1 block font-sans text-[11px] text-muted-foreground">{c.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Script src="https://www.paytr.com/js/iframeResizer.min.js" strategy="afterInteractive" />
          <iframe
            src={paytr.iframeUrl || `https://www.paytr.com/odeme/guvenli/${paytr.token}`}
            id="paytriframe"
            title="PAYTR ödeme"
            frameBorder={0}
            scrolling="no"
            style={{ width: "100%", minHeight: 420 }}
          />
          <p className="text-xs text-muted-foreground">
            Ödeme tamamlandıktan sonra bu sayfaya yönlendirileceksiniz. Onay, bankadan gelen bildirimle
            otomatik işlenir.
          </p>
        </div>
      ) : null}
    </div>
  );
}
