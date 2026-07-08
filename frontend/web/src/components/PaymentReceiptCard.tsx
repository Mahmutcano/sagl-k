"use client";

import { type PaymentReceipt } from "@/lib/application";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer } from "lucide-react";

type Props = {
  receipt: PaymentReceipt;
  fallbackApplicationNumber?: string;
  showPrint?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatDate(value?: string) {
  if (!value) return new Date().toLocaleString("tr-TR");
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("tr-TR");
}

function isInternalReference(value?: string): boolean {
  if (!value?.trim()) return true;
  const v = value.trim();
  if (UUID_RE.test(v)) return true;
  if (/^param-test-/i.test(v)) return true;
  if (/^bh-inv-test-/i.test(v)) return true;
  return false;
}

function applicationDisplayNo(receipt: PaymentReceipt, fallback?: string): string {
  if (receipt.applicationNumber?.trim()) return receipt.applicationNumber.trim();
  if (fallback && !UUID_RE.test(fallback)) return fallback;
  if (receipt.ecommerceNumber?.trim()) return receipt.ecommerceNumber.trim();
  return "—";
}

function cardLastFour(maskedCard?: string): string | null {
  if (!maskedCard) return null;
  const digits = maskedCard.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function cardDisplay(maskedCard?: string, cardBrand?: string): string | null {
  const last4 = cardLastFour(maskedCard);
  if (!last4) return null;
  const brand = cardBrand?.trim();
  return brand ? `${brand} · **** ${last4}` : `**** **** **** ${last4}`;
}

/** Hasta arayüzünde gösterilebilecek onay/referans kodu (iç sistem ID'leri hariç). */
function publicAuthReference(receipt: PaymentReceipt): string | null {
  if (receipt.authReference && !isInternalReference(receipt.authReference)) {
    return receipt.authReference;
  }
  if (receipt.ecommerceNumber && !isInternalReference(receipt.ecommerceNumber)) {
    return receipt.ecommerceNumber;
  }
  if (receipt.transactionId && !isInternalReference(receipt.transactionId)) {
    return receipt.transactionId;
  }
  return null;
}

function invoiceStatusLabel(receipt: PaymentReceipt): string {
  if (receipt.invoiceStatusLabel) return receipt.invoiceStatusLabel;
  if (receipt.invoiceStatus) {
    switch (receipt.invoiceStatus.toLowerCase()) {
      case "issued":
        return "Fatura düzenlendi";
      case "paid":
        return "Ödeme onaylandı";
      default:
        break;
    }
  }
  return "Başarılı";
}

type DekontRow = { label: string; value: string };

function buildDekontRows(receipt: PaymentReceipt, appNo: string): DekontRow[] {
  const rows: DekontRow[] = [
    { label: "İşlem tarihi", value: formatDate(receipt.paidAt) },
    { label: "İşlem tipi", value: "Satış" },
  ];

  const card = cardDisplay(receipt.maskedCard, receipt.cardBrand);
  if (card) rows.push({ label: "Kart", value: card });

  rows.push({ label: "Hizmet", value: receipt.description });
  rows.push({ label: "Başvuru no", value: appNo });

  const authRef = publicAuthReference(receipt);
  if (authRef) rows.push({ label: "Onay referansı", value: authRef });

  if (receipt.professionName) rows.push({ label: "Bölüm", value: receipt.professionName });
  if (receipt.doctorName) rows.push({ label: "Uzman", value: receipt.doctorName });

  rows.push({ label: "Tutar", value: formatMoney(receipt.amount, receipt.currency) });
  rows.push({ label: "Ödeme kanalı", value: "Param · Kredi kartı" });

  if (receipt.invoiceNumber && !isInternalReference(receipt.invoiceNumber)) {
    rows.push({ label: "Fatura no", value: receipt.invoiceNumber });
  }

  const invStatus = invoiceStatusLabel(receipt);
  rows.push({ label: "Durum", value: invStatus });

  return rows;
}

export function PaymentReceiptCard({ receipt, fallbackApplicationNumber, showPrint = true }: Props) {
  const appNo = applicationDisplayNo(receipt, fallbackApplicationNumber);
  const rows = buildDekontRows(receipt, appNo);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * { visibility: hidden !important; }
          #patient-payment-dekont, #patient-payment-dekont * {
            visibility: visible !important;
          }
          #patient-payment-dekont {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 8mm auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
        }
      `,
        }}
      />

      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4 print:hidden">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Ödemeniz başarıyla alındı</p>
            <p className="text-sm text-muted-foreground mt-1">
              Başvurunuz uzman hekim değerlendirmesine iletildi. Makbuzunuzu yazdırarak
              saklayabilirsiniz.
            </p>
          </div>
        </div>

        <div
          id="patient-payment-dekont"
          className="mx-auto w-full max-w-md rounded-lg border border-border bg-card text-card-foreground shadow-sm print:max-w-none print:rounded-none print:shadow-none"
        >
          <div className="border-b border-dashed border-border px-5 py-4 text-center print:border-black">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground print:text-black">
              Erciyes Üniversitesi
            </p>
            <h3 className="mt-1 text-base font-bold tracking-tight text-foreground print:text-black">
              Tıbbi Danışmanlık
            </h3>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground print:text-black">
              Ödeme dekontu
            </p>
          </div>

          <div className="px-5 py-4">
            <div className="mb-4 border border-border bg-muted/30 px-3 py-2 text-center print:border-black print:bg-white">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground print:text-black">
                Tahsil edilen tutar
              </p>
              <p className="text-2xl font-bold tabular-nums text-foreground print:text-black">
                {formatMoney(receipt.amount, receipt.currency)}
              </p>
            </div>

            <div className="space-y-0 text-sm">
              {rows.map((row, index) => (
                <div
                  key={row.label}
                  className={`flex items-start justify-between gap-4 py-2 ${
                    index < rows.length - 1 ? "border-b border-dashed border-border print:border-black" : ""
                  }`}
                >
                  <span className="shrink-0 text-xs text-muted-foreground print:text-black">
                    {row.label}
                  </span>
                  <span className="text-right text-xs font-medium text-foreground print:text-black">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-dashed border-border px-5 py-3 print:border-black">
            <p className="text-center text-[10px] leading-relaxed text-muted-foreground print:text-black">
              Bu dekont bilgilendirme amaçlıdır. Resmi fatura numaranız yukarıda
              belirtilmiştir. Sorularınız için başvuru numaranızı kullanabilirsiniz.
            </p>
          </div>
        </div>

        {showPrint ? (
          <div className="flex justify-end print:hidden">
            <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Dekontu yazdır
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
