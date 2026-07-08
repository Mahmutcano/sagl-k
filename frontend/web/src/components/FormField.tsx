"use client";

import { useEffect, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function FormField({ id, label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={id} className="font-semibold text-foreground leading-none">{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
};

export function TextInput({
  id,
  label,
  hint,
  error,
  fieldClassName,
  className,
  ...rest
}: InputProps & { className?: string }) {
  return (
    <FormField id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <Input
        id={id}
        className={cn("min-w-0", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </FormField>
  );
}

export { TextInput as DateField };

const TR_MONTHS = [
  { value: "01", label: "Ocak" },
  { value: "02", label: "Şubat" },
  { value: "03", label: "Mart" },
  { value: "04", label: "Nisan" },
  { value: "05", label: "Mayıs" },
  { value: "06", label: "Haziran" },
  { value: "07", label: "Temmuz" },
  { value: "08", label: "Ağustos" },
  { value: "09", label: "Eylül" },
  { value: "10", label: "Ekim" },
  { value: "11", label: "Kasım" },
  { value: "12", label: "Aralık" },
] as const;

function daysInMonth(month: string, year: string): number {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!m || !y) return 31;
  return new Date(y, m, 0).getDate();
}

function parseBirthDate(iso: string): { day: string; month: string; year: string } {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { day: "", month: "", year: "" };
  }
  const [year, month, day] = iso.split("-");
  return { day, month, year };
}

function composeBirthDate(day: string, month: string, year: string): string {
  if (!day || !month || !year) return "";
  return `${year}-${month}-${day}`;
}

type BirthDateSelectProps = {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
  value: string;
  onChange: (isoDate: string) => void;
};

export function BirthDateSelect({
  id = "dateOfBirth",
  label = "Doğum tarihi",
  hint,
  error,
  fieldClassName,
  value,
  onChange,
}: BirthDateSelectProps) {
  const [parts, setParts] = useState(() => parseBirthDate(value));

  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setParts(parseBirthDate(value));
    }
  }, [value]);

  const { day, month, year } = parts;
  const maxDay = daysInMonth(month, year);
  const dayOptions = Array.from({ length: maxDay }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return { value: d, label: d };
  });
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 100 }, (_, i) => {
    const y = String(currentYear - i);
    return { value: y, label: y };
  });

  function update(part: "day" | "month" | "year", next: string) {
    let d = part === "day" ? next : parts.day;
    const m = part === "month" ? next : parts.month;
    const y = part === "year" ? next : parts.year;
    if (d && m && y) {
      const max = daysInMonth(m, y);
      if (parseInt(d, 10) > max) d = String(max).padStart(2, "0");
    }
    const nextParts = { day: d, month: m, year: y };
    setParts(nextParts);
    if (d && m && y) {
      const iso = composeBirthDate(d, m, y);
      if (iso !== value) onChange(iso);
    } else if (value) {
      onChange("");
    }
  }

  const subSelect = (
    part: "day" | "month" | "year",
    partValue: string,
    placeholder: string,
    options: { value: string; label: string }[]
  ) => (
    <Select value={partValue || undefined} onValueChange={(v) => update(part, v)}>
      <SelectTrigger
        id={part === "day" ? id : undefined}
        aria-invalid={error ? true : undefined}
        className="min-w-0 w-full"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <FormField id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2 min-w-0">
        {subSelect("day", day, "Gün", dayOptions)}
        <Select value={month || undefined} onValueChange={(v) => update("month", v)}>
          <SelectTrigger className="min-w-0 w-full">
            <SelectValue placeholder="Ay" />
          </SelectTrigger>
          <SelectContent>
            {TR_MONTHS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {subSelect("year", year, "Yıl", yearOptions)}
      </div>
    </FormField>
  );
}

type SelectOption = { value: string; label: string };

type SelectProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  name?: string;
};

export function FormSelect({
  id,
  label,
  hint,
  error,
  fieldClassName,
  options,
  placeholder = "Seçin",
  value,
  defaultValue,
  disabled,
  onChange,
  name,
}: SelectProps) {
  return (
    <FormField id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <Select
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onValueChange={(v) =>
          onChange?.({ target: { value: v, name: name ?? id } })
        }
      >
        <SelectTrigger id={id} aria-invalid={error ? true : undefined} className="min-w-0 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {name ? <input type="hidden" name={name} value={value ?? defaultValue ?? ""} readOnly /> : null}
    </FormField>
  );
}

export function FormAlert({
  title,
  message,
  variant = "destructive",
}: {
  title?: string;
  message: string;
  variant?: "destructive" | "default";
}) {
  return (
    <Alert variant={variant === "destructive" ? "destructive" : "default"}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
