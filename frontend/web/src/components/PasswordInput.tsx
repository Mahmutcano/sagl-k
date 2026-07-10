"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FormField } from "@/components/FormField";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
  /** Start with password visible (e.g. admin generated password). */
  defaultVisible?: boolean;
};

export function PasswordInput({
  id,
  label,
  hint,
  error,
  fieldClassName,
  className,
  defaultVisible = false,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(defaultVisible);

  return (
    <FormField id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className={cn("min-w-0 pr-11", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...rest}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-1.5 text-slate-500"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
          tabIndex={0}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </FormField>
  );
}
