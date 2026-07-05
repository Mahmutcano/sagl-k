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
  return "secondary";
}

export type StatusHistoryItem = {
  oldStatusCode?: number | null;
  newStatusCode: number;
  note?: string | null;
  createdAt: string;
};
