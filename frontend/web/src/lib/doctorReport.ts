export type DoctorReportData = {
  summary: string;
  findings: string;
  recommendations: string;
  followUp: string;
};

export const REPORT_SECTIONS = [
  {
    key: "summary" as const,
    label: "Tıbbi Özet & Tanı",
    hint: "Hastanın öyküsü, şikayet özeti ve tanı değerlendirmesi",
    placeholder:
      "Hastanın öyküsü, şikayetlerinin özeti ve genel tanı izlenimlerinizi buraya yazın...",
    required: true,
    minLength: 20,
  },
  {
    key: "findings" as const,
    label: "Tetkik ve Muayene Bulguları",
    hint: "Fiziksel muayene, laboratuvar ve görüntüleme bulguları",
    placeholder:
      "EKG, tahlil, tetkik veya fiziksel muayene bulgularını buraya yazın...",
    required: false,
    minLength: 0,
  },
  {
    key: "recommendations" as const,
    label: "Tedavi Planı & Öneriler",
    hint: "İlaç, diyet, yaşam tarzı ve tedavi önerileri",
    placeholder:
      "Hastanın uygulaması gereken tedavi adımlarını ve önerilerinizi buraya yazın...",
    required: false,
    minLength: 0,
  },
  {
    key: "followUp" as const,
    label: "Kontrol & Takip Planı",
    hint: "Kontrol zamanı ve acil başvuru kriterleri",
    placeholder:
      "Kontrol süresi ve acil başvuru gerektiren durumları belirtin...",
    required: false,
    minLength: 0,
  },
] as const;

export function emptyReport(): DoctorReportData {
  return { summary: "", findings: "", recommendations: "", followUp: "" };
}

export function parseReportData(raw: string | unknown): DoctorReportData {
  const base = emptyReport();
  if (!raw) return base;
  try {
    const parsed =
      typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, string>)
        : (raw as Record<string, string>);
    return {
      summary: parsed.summary ?? "",
      findings: parsed.findings ?? parsed.diagnosis ?? "",
      recommendations: parsed.recommendations ?? "",
      followUp: parsed.followUp ?? "",
    };
  } catch {
    if (typeof raw === "string") return { ...base, summary: raw };
    return base;
  }
}

export function serializeReport(data: DoctorReportData): string {
  return JSON.stringify(data);
}

export type ReportValidationError = {
  field: keyof DoctorReportData;
  message: string;
};

export function validateReport(data: DoctorReportData): ReportValidationError[] {
  const errors: ReportValidationError[] = [];
  for (const section of REPORT_SECTIONS) {
    const value = data[section.key].trim();
    if (section.required && !value) {
      errors.push({ field: section.key, message: `${section.label} alanı zorunludur.` });
    } else if (section.minLength > 0 && value && value.length < section.minLength) {
      errors.push({
        field: section.key,
        message: `${section.label} en az ${section.minLength} karakter olmalıdır.`,
      });
    }
  }
  return errors;
}
