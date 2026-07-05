"use client";

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
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
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

export function TextInput({ id, label, hint, error, fieldClassName, ...rest }: InputProps) {
  return (
    <FormField id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </FormField>
  );
}

export { TextInput as DateField };

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
        <SelectTrigger id={id} aria-invalid={error ? true : undefined}>
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
