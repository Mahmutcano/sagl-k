export const MIN_SURVEY_ANSWER_LEN = 10;
export const MAX_SURVEY_ANSWER_LEN = 2000;

export type ApplicationSurveyAnswers = {
  chiefComplaint: string;
  medicalHistory: string;
  currentMedications: string;
  previousDiagnosis: string;
  questionsForDoctor: string;
  additionalNotes: string;
};

export const EMPTY_SURVEY: ApplicationSurveyAnswers = {
  chiefComplaint: "",
  medicalHistory: "",
  currentMedications: "",
  previousDiagnosis: "",
  questionsForDoctor: "",
  additionalNotes: "",
};

export const SURVEY_FIELDS: {
  key: keyof ApplicationSurveyAnswers;
  label: string;
  hint?: string;
  required?: boolean;
  rows?: number;
}[] = [
  {
    key: "chiefComplaint",
    label: "Başvuru nedeni / şikayet",
    hint: "Mevcut şikayetinizi ve ne için danışmak istediğinizi yazın.",
    required: true,
    rows: 4,
  },
  {
    key: "medicalHistory",
    label: "Tıbbi öykü",
    hint: "Geçmiş hastalıklar, ameliyatlar, kronik durumlar.",
    required: true,
    rows: 4,
  },
  {
    key: "currentMedications",
    label: "Kullandığı ilaçlar",
    hint: "Düzenli kullandığınız ilaçlar (yoksa boş bırakın).",
    rows: 3,
  },
  {
    key: "previousDiagnosis",
    label: "Önceki tanı ve tedaviler",
    hint: "Daha önce aldığınız tanılar, tetkikler veya tedaviler.",
    rows: 3,
  },
  {
    key: "questionsForDoctor",
    label: "Doktora sormak istediğiniz sorular",
    hint: "Uzmanın yanıtlamasını istediğiniz soruları listeleyin.",
    required: true,
    rows: 4,
  },
  {
    key: "additionalNotes",
    label: "Ek açıklama",
    rows: 3,
  },
];

export type FieldErrors = Record<string, string>;

function charCount(value: string): number {
  return Array.from(value).length;
}

export function validateApplicationSurvey(input: ApplicationSurveyAnswers): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of SURVEY_FIELDS) {
    const value = input[field.key]?.trim() ?? "";
    if (field.required) {
      if (!value) {
        errors[field.key] = `${field.label} zorunludur.`;
        continue;
      }
      if (charCount(value) < MIN_SURVEY_ANSWER_LEN) {
        errors[field.key] = `${field.label} en az ${MIN_SURVEY_ANSWER_LEN} karakter olmalıdır.`;
      }
    }
    if (value && charCount(value) > MAX_SURVEY_ANSWER_LEN) {
      errors[field.key] = `${field.label} en fazla ${MAX_SURVEY_ANSWER_LEN} karakter olabilir.`;
    }
  }
  return errors;
}

export function summarizeSurveyErrors(errors: FieldErrors): string {
  const msgs = Object.values(errors);
  if (msgs.length === 0) return "Lütfen işaretli alanları düzeltin.";
  if (msgs.length === 1) return msgs[0];
  return `Lütfen ${msgs.length} alanı düzeltin: ${msgs.slice(0, 3).join(" · ")}`;
}

export function surveyAnswersToJSON(input: ApplicationSurveyAnswers): string {
  const out: Record<string, string> = {};
  for (const field of SURVEY_FIELDS) {
    out[field.key] = input[field.key]?.trim() ?? "";
  }
  return JSON.stringify(out);
}

export function parseSurveyData(raw: unknown): ApplicationSurveyAnswers {
  if (!raw) return { ...EMPTY_SURVEY };
  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { ...EMPTY_SURVEY };
    }
  } else if (typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return { ...EMPTY_SURVEY };
  }
  const read = (key: keyof ApplicationSurveyAnswers) =>
    typeof obj[key] === "string" ? (obj[key] as string) : "";
  return {
    chiefComplaint: read("chiefComplaint"),
    medicalHistory: read("medicalHistory"),
    currentMedications: read("currentMedications"),
    previousDiagnosis: read("previousDiagnosis"),
    questionsForDoctor: read("questionsForDoctor"),
    additionalNotes: read("additionalNotes"),
  };
}

export const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

export const MAX_FILES = 10;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function validateSelectedFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) {
    return `En fazla ${MAX_FILES} dosya yükleyebilirsiniz.`;
  }
  const allowed = new Set(Object.keys(ACCEPTED_FILE_TYPES));
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" 10 MB sınırını aşıyor.`;
    }
    const mime = file.type || guessMime(file.name);
    if (!allowed.has(mime)) {
      return `"${file.name}" desteklenmiyor. Yalnızca PDF, JPEG ve PNG.`;
    }
  }
  return null;
}

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function uploadApplicationAttachments(
  applicationId: string,
  files: File[],
  token: string
): Promise<void> {
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/v1/applications/${applicationId}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.hasError) {
      throw new Error(body.responseMessage || `"${file.name}" yüklenemedi.`);
    }
  }
}

export async function downloadApplicationAttachment(
  applicationId: string,
  attachmentId: string,
  fileName: string,
  token: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/v1/applications/${applicationId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Dosya indirilemedi.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
