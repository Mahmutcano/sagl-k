"use client";

import { FormField } from "@/components/FormField";
import { CountrySearchSelect } from "@/components/CountrySearchSelect";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PHONE_COUNTRY,
  formatNationalInput,
  normalizeNationalNumber,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  countryDial: string;
  nationalNumber: string;
  onCountryChange: (dial: string) => void;
  onNationalChange: (national: string) => void;
  disabled?: boolean;
  className?: string;
};

export function PhoneNumberField({
  id = "phoneNumber",
  label = "Cep telefonu",
  hint,
  error,
  countryDial,
  nationalNumber,
  onCountryChange,
  onNationalChange,
  disabled,
  className,
}: Props) {
  const dial = countryDial || DEFAULT_PHONE_COUNTRY.dial;

  return (
    <FormField id={id} label={label} hint={hint} error={error} className={className}>
      <div className="flex gap-2">
        <CountrySearchSelect
          id={`${id}-country`}
          label=""
          mode="dial"
          value={dial}
          onChange={(v) => {
            onCountryChange(v);
            onNationalChange(normalizeNationalNumber(nationalNumber, v));
          }}
          disabled={disabled}
          triggerClassName="h-9"
        />
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          placeholder={dial === "+90" ? "5XX XXX XX XX" : "Telefon numarası"}
          className={cn("min-w-0 flex-1")}
          value={formatNationalInput(nationalNumber, dial)}
          onChange={(e) => onNationalChange(normalizeNationalNumber(e.target.value, dial))}
          aria-invalid={error ? true : undefined}
        />
      </div>
    </FormField>
  );
}
