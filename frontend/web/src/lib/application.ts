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

/** Hekim / sekreterya arayüzü — ödeme bilgisi gösterilmez */
export const STAFF_STATUS_LABELS: Record<number, string> = {
  0: "Başvuru tamamlanmadı",
  1: "Başvuru yapıldı",
  2: "Sonuç bekleniyor",
  3: "Reddedildi",
  4: "Sonuç bekleniyor",
  5: "Ek bilgi gerekli",
  6: "Sonuçlandı",
  7: "İptal edildi",
  8: "İade sürecinde",
  9: "İade edildi",
  10: "Sonuç bekleniyor",
  11: "Sekreterya incelemesi",
};

export function staffStatusLabel(code: number): string {
  return STAFF_STATUS_LABELS[code] ?? STATUS_LABELS[code] ?? `Durum ${code}`;
}

export function statusVariant(code: number): "default" | "secondary" | "outline" | "destructive" {
  if (code === 6) return "default";
  if (code === 0) return "outline";
  if (code === 3 || code === 5 || code === 7) return "destructive";
  return "secondary";
}

export function isConcludedStatus(code: number): boolean {
  return code === 6;
}

export function isDoctorReportWritable(code: number): boolean {
  return code !== 3 && code !== 7 && code !== 0;
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

export type ApplicationAttachment = {
  id: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  createdAt?: string;
};

export type ApplicationDetail = {
  applicationId: string;
  applicationNumber?: string | null;
  statusCode: number;
  ecommerceNumber?: string | null;
  professionCode?: string | null;
  professionName?: string | null;
  careProviderId?: string | null;
  patientName?: string | null;
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

export function isPatientEditableStatus(code: number): boolean {
  return code === 0;
}

/** Ödeme alındıktan sonra doktor değerlendirmesi bekleniyor. */
export function isPatientAwaitingDoctor(code: number): boolean {
  return [1, 2, 4, 5, 10, 11].includes(code);
}

export function isPatientCancellableStatus(code: number): boolean {
  return code === 0;
}

/** Hasta listesinde başvuruların gruplandırılması — sıra önemli, karıştırılmamalı. */
export type PatientApplicationGroup = {
  id: string;
  title: string;
  description: string;
  stepHint?: string;
  statusCodes: number[];
};

export const PATIENT_APPLICATION_GROUPS: PatientApplicationGroup[] = [
  {
    id: "pending",
    title: "Tamamlanmayı bekleyen",
    description: "Ödeme yapılmadı — kaldığınız adımdan devam edin veya silin.",
    stepHint: "1 Bölüm → 2 Şikayet → 3 Form önizleme → 4 Ödeme (ayrı adımlar)",
    statusCodes: [0],
  },
  {
    id: "in_progress",
    title: "İşlemde",
    description: "Ödemeniz alındı; doktorunuz başvurunuzu değerlendiriyor.",
    statusCodes: [1, 2, 4, 5, 10, 11],
  },
  {
    id: "completed",
    title: "Sonuçlanan",
    description: "Doktor raporu hazır.",
    statusCodes: [6],
  },
  {
    id: "closed",
    title: "Kapalı",
    description: "Reddedilen, iptal veya iade edilmiş başvurular.",
    statusCodes: [3, 7, 8, 9],
  },
];

export function groupPatientApplications<T extends { statusCode: number }>(
  items: T[]
): { group: PatientApplicationGroup; items: T[] }[] {
  return PATIENT_APPLICATION_GROUPS.map((group) => ({
    group,
    items: items.filter((item) => group.statusCodes.includes(item.statusCode)),
  })).filter((g) => g.items.length > 0);
}

export function normalizePaymentResult(raw: Record<string, unknown>): PaymentResult {
  const receiptRaw = raw.receipt;
  const receipt =
    receiptRaw && typeof receiptRaw === "object"
      ? normalizePaymentReceipt(receiptRaw as Record<string, unknown>)
      : undefined;

  return {
    transactionId: String(raw.transactionId ?? raw.TransactionID ?? receipt?.transactionId ?? ""),
    orderId: String(raw.orderId ?? raw.OrderID ?? ""),
    status: String(raw.status ?? raw.Status ?? ""),
    redirectUrl: (raw.redirectUrl ?? raw.RedirectURL ?? null) as string | null,
    paymentId: String(raw.paymentId ?? raw.PaymentID ?? receipt?.paymentId ?? ""),
    receipt,
  };
}

export function normalizePaymentReceipt(raw: Record<string, unknown>): PaymentReceipt {
  return {
    amount: Number(raw.amount ?? 0),
    currency: String(raw.currency ?? "TRY"),
    provider: String(raw.provider ?? "param"),
    providerLabel: String(raw.providerLabel ?? "Param"),
    transactionId: String(raw.transactionId ?? ""),
    paymentId: String(raw.paymentId ?? ""),
    applicationId: String(raw.applicationId ?? ""),
    applicationNumber: raw.applicationNumber ? String(raw.applicationNumber) : undefined,
    ecommerceNumber: raw.ecommerceNumber ? String(raw.ecommerceNumber) : undefined,
    authReference: raw.authReference ? String(raw.authReference) : undefined,
    professionName: raw.professionName ? String(raw.professionName) : undefined,
    doctorName: raw.doctorName ? String(raw.doctorName) : undefined,
    paidAt: raw.paidAt ? String(raw.paidAt) : undefined,
    description: raw.description ? String(raw.description) : "Tıbbi danışmanlık başvuru ücreti",
    maskedCard: raw.maskedCard ? String(raw.maskedCard) : undefined,
    cardBrand: raw.cardBrand ? String(raw.cardBrand) : undefined,
    invoiceId: raw.invoiceId ? String(raw.invoiceId) : undefined,
    invoiceNumber: raw.invoiceNumber ? String(raw.invoiceNumber) : undefined,
    invoiceProvider: raw.invoiceProvider ? String(raw.invoiceProvider) : undefined,
    invoiceProviderLabel: raw.invoiceProviderLabel ? String(raw.invoiceProviderLabel) : "Bizim Hesap",
    invoiceStatus: raw.invoiceStatus ? String(raw.invoiceStatus) : undefined,
    invoiceStatusLabel: raw.invoiceStatusLabel ? String(raw.invoiceStatusLabel) : undefined,
    invoiceError: raw.invoiceError ? String(raw.invoiceError) : undefined,
  };
}

export type PaymentReceipt = {
  amount: number;
  currency: string;
  provider: string;
  providerLabel: string;
  transactionId: string;
  paymentId: string;
  applicationId: string;
  applicationNumber?: string;
  ecommerceNumber?: string;
  authReference?: string;
  professionName?: string;
  doctorName?: string;
  paidAt?: string;
  description: string;
  maskedCard?: string;
  cardBrand?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceProvider?: string;
  invoiceProviderLabel?: string;
  invoiceStatus?: string;
  invoiceStatusLabel?: string;
  invoiceError?: string;
};

export type PaymentResult = {
  transactionId?: string;
  orderId?: string;
  status: string;
  redirectUrl?: string | null;
  paymentId?: string;
  receipt?: PaymentReceipt;
};

export function isPaymentSuccessful(status: string): boolean {
  const s = status.toLowerCase();
  return s === "paid" || s === "success" || s === "completed";
}

export function isSurveyComplete(surveyData: unknown): boolean {
  const survey =
    typeof surveyData === "object" && surveyData !== null
      ? (surveyData as Record<string, unknown>)
      : {};
  const read = (k: string) => (typeof survey[k] === "string" ? (survey[k] as string).trim() : "");
  return (
    read("chiefComplaint").length >= 10 &&
    read("medicalHistory").length >= 10 &&
    read("questionsForDoctor").length >= 10
  );
}

/** Düzenleme modunda kullanıcının kaldığı sihirbaz adımını belirler. */
export function resumeWizardStep(app: ApplicationDetail): "details" | "survey" | "preview" | "payment" {
  if (!app.professionCode?.trim()) return "details";
  if (!isSurveyComplete(app.surveyData)) return "survey";
  return "preview";
}

const WIZARD_STEPS = ["details", "survey", "preview", "payment"] as const;
export type WizardStepId = (typeof WIZARD_STEPS)[number];

/** URL ?step= veya otomatik devam adımı. Ödeme yalnızca önizleme tamamlandıysa ve status 0 ise. */
export function resolveEditStep(
  app: ApplicationDetail,
  stepParam: string | null
): WizardStepId {
  const resumed = resumeWizardStep(app);
  if (!stepParam || !WIZARD_STEPS.includes(stepParam as WizardStepId)) {
    return resumed;
  }
  const requested = stepParam as WizardStepId;
  if (requested === "payment") {
    if (app.statusCode !== 0) return "preview";
    if (resumed === "details" || resumed === "survey") return resumed;
    return "payment";
  }
  if (app.statusCode === 0 && (requested === "details" || requested === "survey")) {
    return requested;
  }
  const order = WIZARD_STEPS.indexOf(requested);
  const resumedOrder = WIZARD_STEPS.indexOf(resumed);
  if (order > resumedOrder) return resumed;
  return requested;
}

export type PaymentRequest = {
  provider: "param";
  cardHolder: string;
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
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
