"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDownIcon } from "@/components/icons";
import { DatePicker } from "@/components/DatePicker";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

/** Basecoat `.field` — label, control, hint/error with role="group". */
export function FormField({ id, label, hint, error, className, children }: FieldProps) {
  return (
    <div
      role="group"
      className={className ? `field ${className}` : "field"}
      data-invalid={error ? true : undefined}
    >
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`}>{hint}</p>
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

export { DatePicker as DateField } from "@/components/DatePicker";

export function TextInput({ id, label, hint, error, fieldClassName, type, ...rest }: InputProps) {
  if (type === "date") {
    const { value, defaultValue, onChange, name, min, max, disabled } = rest;
    return (
      <DatePicker
        id={id}
        label={label}
        hint={hint}
        error={error}
        fieldClassName={fieldClassName}
        value={typeof value === "string" ? value : undefined}
        defaultValue={typeof defaultValue === "string" ? defaultValue : undefined}
        onChange={onChange as ((e: { target: { value: string } }) => void) | undefined}
        name={name}
        min={typeof min === "string" ? min : undefined}
        max={typeof max === "string" ? max : undefined}
        disabled={disabled}
      />
    );
  }

  return (
    <FormField id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </FormField>
  );
}

type SelectOption = { value: string; label: string };

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
  options: SelectOption[];
  placeholder?: string;
};

/** Basecoat-style custom select with popover listbox. */
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
  const listboxId = useId();
  const triggerId = `${id}-trigger`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(String(defaultValue ?? ""));
  const current = isControlled ? String(value ?? "") : internal;
  const selected = options.find((o) => o.value === current);

  useEffect(() => {
    if (!open) return;
    const selectedIdx = options.findIndex((o) => o.value === current);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);

    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, current]);

  function commit(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.({
      target: { value: next, name: name ?? id },
      currentTarget: { value: next, name: name ?? id },
    } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, (i < 0 ? -1 : i) + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, (i < 0 ? options.length : i) - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && options[activeIndex]) commit(options[activeIndex].value);
    }
  }

  return (
    <FormField id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <div
        ref={rootRef}
        className="select w-full"
        data-placeholder={placeholder}
      >
        <button
          type="button"
          id={triggerId}
          className="w-full"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
        >
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDownIcon className={`opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <div data-popover aria-hidden={!open} data-side="bottom">
          <div
            role="listbox"
            id={listboxId}
            aria-orientation="vertical"
            aria-labelledby={triggerId}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
          >
            {options.map((o, index) => {
              const isSelected = o.value === current;
              const isActive = index === activeIndex;
              return (
                <div
                  key={o.value}
                  id={`${id}-opt-${o.value}`}
                  role="option"
                  data-value={o.value}
                  aria-selected={isSelected}
                  className={isActive ? "active" : undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(o.value)}
                >
                  {o.label}
                </div>
              );
            })}
          </div>
        </div>
        <input type="hidden" id={id} name={name ?? id} value={current} readOnly />
      </div>
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
    <div className="alert" data-variant={variant === "destructive" ? "destructive" : undefined}>
      {title ? <strong>{title}</strong> : null}
      <section>
        <p>{message}</p>
      </section>
    </div>
  );
}
