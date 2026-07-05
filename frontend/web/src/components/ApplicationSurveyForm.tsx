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

export function ApplicationSurveyForm({ value, onChange, errors = {} }: Props) {
  function update<K extends keyof ApplicationSurveyAnswers>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="grid gap-4">
      {SURVEY_FIELDS.map((field) => (
        <FormField
          key={field.key}
          id={field.key}
          label={field.label + (field.required ? " *" : "")}
          hint={field.hint}
          error={errors[field.key]}
        >
          <Textarea
            id={field.key}
            rows={field.rows ?? 3}
            value={value[field.key]}
            onChange={(e) => update(field.key, e.target.value)}
          />
        </FormField>
      ))}
    </div>
  );
}
