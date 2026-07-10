"use client";

import { FormField } from "@/components/FormField";
import { Textarea } from "@/components/ui/textarea";
import {
  SURVEY_FIELDS,
  type ApplicationSurveyAnswers,
  type FieldErrors,
} from "@/lib/applicationSurvey";

type Props = {
  value: ApplicationSurveyAnswers;
  onChange: (next: ApplicationSurveyAnswers) => void;
  errors?: FieldErrors;
};

const SURVEY_PLACEHOLDERS: Record<string, string> = {
  chiefComplaint: "Kısaca şikayetinizi yazın...",
  medicalHistory: "Geçmiş hastalık / ameliyat...",
  currentMedications: "Düzenli ilaçlar (yoksa boş)...",
  previousDiagnosis: "Önceki tanı veya tetkikler...",
  questionsForDoctor: "Doktora sormak istedikleriniz...",
  additionalNotes: "Varsa ek not...",
};

export function ApplicationSurveyForm({ value, onChange, errors = {} }: Props) {
  function update<K extends keyof ApplicationSurveyAnswers>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="grid gap-3">
      {SURVEY_FIELDS.map((field) => {
        const currentLen = value[field.key]?.length || 0;
        const rows = field.rows ?? 2;
        return (
          <FormField
            key={field.key}
            id={field.key}
            label={field.label + (field.required ? " *" : "")}
            hint={field.hint}
            error={errors[field.key]}
          >
            <Textarea
              id={field.key}
              rows={rows}
              placeholder={SURVEY_PLACEHOLDERS[field.key]}
              value={value[field.key]}
              onChange={(e) => update(field.key, e.target.value)}
              maxLength={2000}
              className="min-h-[4.5rem] resize-y text-base sm:text-sm"
            />
            <div className="mt-1 flex items-center justify-between px-0.5 text-[11px] text-muted-foreground">
              <span>{field.required ? "En az 10 karakter" : "İsteğe bağlı"}</span>
              <span className={currentLen >= 2000 ? "font-semibold text-destructive" : ""}>
                {currentLen}/2000
              </span>
            </div>
          </FormField>
        );
      })}
    </div>
  );
}
