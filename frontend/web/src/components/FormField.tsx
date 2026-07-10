"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { MessageModal } from "@/components/MessageModal";
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
    <div className={cn("grid w-full items-center gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[0.8rem] font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.8rem] text-muted-foreground">
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

type BirthDateSelectProps = {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
  value: string;
  onChange: (isoDate: string) => void;
};

function todayParts() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
}

function parseIsoParts(value: string): { y: string; m: string; day: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { y: "", m: "", day: "" };
  const [y, m, day] = value.split("-");
  return { y, m: String(Number(m)), day: String(Number(day)) };
}

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

const BIRTH_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export function BirthDateSelect({
  id = "dateOfBirth",
  label = "Doğum tarihi",
  hint,
  error,
  fieldClassName,
  value,
  onChange,
}: BirthDateSelectProps) {
  const today = todayParts();
  const minYear = today.y - 100;
  const maxYear = today.y;

  const fromValue = parseIsoParts(value);
  const [draft, setDraft] = useState(fromValue);

  useEffect(() => {
    setDraft(parseIsoParts(value));
  }, [value]);

  const yearNum = draft.y ? Number(draft.y) : 0;
  const monthNum = draft.m ? Number(draft.m) : 0;
  const maxDay = daysInMonth(yearNum || maxYear, monthNum || 1);

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  function updateDraft(next: { y: string; m: string; day: string }) {
    let day = next.day;
    if (next.y && next.m && day) {
      const dim = daysInMonth(Number(next.y), Number(next.m));
      if (Number(day) > dim) day = String(dim);
    }
    const normalized = { ...next, day };
    setDraft(normalized);

    if (!normalized.y || !normalized.m || !normalized.day) {
      if (value) onChange("");
      return;
    }

    const y = Number(normalized.y);
    const m = Number(normalized.m);
    const d = Number(normalized.day);
    if (y > today.y || (y === today.y && m > today.m) || (y === today.y && m === today.m && d > today.day)) {
      return;
    }

    onChange(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const selectClass =
    "flex h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <FormField id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
        <div className="min-w-0">
          <label htmlFor={`${id}-day`} className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Gün
          </label>
          <select
            id={`${id}-day`}
            className={selectClass}
            value={draft.day}
            size={1}
            aria-invalid={error ? true : undefined}
            onChange={(e) => updateDraft({ ...draft, day: e.target.value })}
          >
            <option value="">—</option>
            {days.map((d) => (
              <option key={d} value={String(d)}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-month`} className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Ay
          </label>
          <select
            id={`${id}-month`}
            className={selectClass}
            value={draft.m}
            aria-invalid={error ? true : undefined}
            onChange={(e) => updateDraft({ ...draft, m: e.target.value })}
          >
            <option value="">—</option>
            {BIRTH_MONTHS.map((name, idx) => (
              <option key={name} value={String(idx + 1)}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-year`} className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Yıl
          </label>
          <select
            id={`${id}-year`}
            className={cn(selectClass, "max-h-48")}
            value={draft.y}
            aria-invalid={error ? true : undefined}
            onChange={(e) => updateDraft({ ...draft, y: e.target.value })}
          >
            <option value="">—</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
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
  const realOptions = options.filter((o) => o.value !== "");
  const selectValue = value && value !== "" ? value : undefined;

  return (
    <FormField id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <Select
        value={selectValue}
        defaultValue={defaultValue && defaultValue !== "" ? defaultValue : undefined}
        disabled={disabled}
        onValueChange={(v) =>
          onChange?.({ target: { value: v, name: name ?? id } })
        }
      >
        <SelectTrigger id={id} aria-invalid={error ? true : undefined} className="min-w-0 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[200]">
          {realOptions.map((o) => (
            <SelectItem key={`${id}-${o.value}`} value={o.value}>
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
  if (!message) return null;
  return (
    <MessageModal
      title={title}
      message={message}
      variant={variant === "destructive" ? "destructive" : "default"}
    />
  );
}
