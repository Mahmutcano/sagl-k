"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FormField } from "@/components/FormField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
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
          className={cn("pr-10", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...rest}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </FormField>
  );
}
