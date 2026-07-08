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
  chiefComplaint: "Örn: Yaklaşık 3 aydır devam eden göğüste sıkışma hissi, nefes darlığı ve merdiven çıkarken çabuk yorulma şikayeti...",
  medicalHistory: "Örn: 5 yıl önce konulmuş hipertansiyon tanısı, düzenli tansiyon takibi yapılıyor. 2018 yılında apandisit ameliyatı...",
  currentMedications: "Örn: Coraspin 100mg günde 1 kez, Beloc ZOK 50mg günde 1 kez...",
  previousDiagnosis: "Örn: Kardiyoloji muayenesi sonrası koroner arter hastalığı şüphesi, EKG ve Efor testi sonuçları ek belgelerdedir...",
  questionsForDoctor: "Örn: 1. Mevcut şikayetlerime göre bypass ameliyatı olmam gerekli mi?\n2. İlaç tedavisine devam edebilir miyim?",
  additionalNotes: "Varsa belirtmek istediğiniz diğer hususları, ailedeki genetik hastalık geçmişini vb. buraya yazabilirsiniz...",
};

export function ApplicationSurveyForm({ value, onChange, errors = {} }: Props) {
  function update<K extends keyof ApplicationSurveyAnswers>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="grid gap-4 sm:gap-5">
      {SURVEY_FIELDS.map((field) => {
        const currentLen = value[field.key]?.length || 0;
        const rows = field.rows ?? 3;
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
              className="resize-y min-h-[5.5rem] sm:min-h-[6rem] text-base sm:text-sm"
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-1 px-1">
              <span>
                {field.required ? "(En az 10 karakter girilmelidir)" : "(İsteğe bağlı)"}
              </span>
              <span className={currentLen >= 2000 ? "text-destructive font-semibold" : ""}>
                {currentLen} / 2000
              </span>
            </div>
          </FormField>
        );
      })}
    </div>
  );
}
