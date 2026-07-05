export const STATUS_LABELS: Record<number, string> = {
  0: "Ödeme bekleniyor",
  1: "Ödeme alındı",
  2: "Onaylandı",
  3: "Reddedildi",
  4: "İşlemde",
  5: "Ek bilgi gerekli",
  6: "Sonuçlandı",
  7: "İptal edildi",
  8: "İade bekleniyor",
  9: "İade edildi",
  10: "Doktor onayı bekleniyor",
  11: "Sekreterya incelemesi",
};

export function statusVariant(code: number): "default" | "secondary" | "outline" | "destructive" {
  if (code === 6) return "default";
  if (code === 0) return "outline";
  if (code === 3 || code === 5 || code === 7) return "destructive";
  return "secondary";
}

export function isConcludedStatus(code: number): boolean {
  return code === 6;
}

export function isDoctorEditableStatus(code: number): boolean {
  return code !== 6 && code !== 3 && code !== 7 && code !== 0;
}

export function isNurseReviewStatus(code: number): boolean {
  return [1, 4, 5, 11].includes(code);
}

export function applicationDisplayNumber(item: {
  applicationNumber?: string | null;
  ecommerceNumber?: string | null;
}): string {
  return item.applicationNumber ?? item.ecommerceNumber ?? "—";
}

export type ApplicationDetail = {
  applicationId: string;
  applicationNumber?: string | null;
  statusCode: number;
  ecommerceNumber?: string | null;
  professionCode?: string | null;
  professionName?: string | null;
  isForRelative?: boolean;
  surveyData?: unknown;
  representedPerson?: {
    firstName?: string;
    lastName?: string;
    nationalIdentifier?: string | null;
    birthDate?: string;
    gender?: number;
  };
};

export type FinalReport = {
  reportJson: unknown;
  createdAt?: string;
};

export type ApplicationNote = {
  content: string;
  author: string;
  createdAt: string;
};

export type PaymentResult = {
  transactionId?: string;
  orderId?: string;
  status: string;
  redirectUrl?: string | null;
  paymentId?: string;
};

export type PaymentRequest = {
  provider: "param" | "bizimhesap";
  cardHolder?: string;
  cardNumber?: string;
  expiryMonth?: number;
  expiryYear?: number;
  cvv?: string;
};

export type StatusHistoryItem = {
  oldStatusCode?: number | null;
  newStatusCode: number;
  note?: string | null;
  createdAt: string;
};

export const DEFAULT_REPORT_DRAFT = JSON.stringify(
  { summary: "", findings: "", recommendations: "" },
  null,
  2
);

export const DEFAULT_CONCLUDE_REPORT = JSON.stringify(
  { summary: "", diagnosis: "", recommendations: "", followUp: "" },
  null,
  2
);
