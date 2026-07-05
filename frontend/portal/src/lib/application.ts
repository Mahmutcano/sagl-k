export const STATUS_LABELS: Record<number, string> = {
  0: "Ödeme bekleniyor",
  1: "Sekreterya incelemesi",
  2: "Doktor incelemesi",
  4: "Değerlendirme",
  5: "Beklemede",
  10: "Rapor hazırlanıyor",
  11: "Tamamlandı",
};

export function statusVariant(code: number): "default" | "secondary" | "outline" | "destructive" {
  if (code === 11) return "default";
  if (code === 0) return "outline";
  if (code === 5) return "destructive";
  return "secondary";
}

export type ApplicationDetail = {
  applicationId: string;
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

export type ApplicationNote = {
  content: string;
  author: string;
  createdAt: string;
};

export type PaymentResult = {
  transactionId?: string;
  orderId?: string;
  status: string;
};
