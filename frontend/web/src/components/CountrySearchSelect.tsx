"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CountryOption } from "@/lib/countries";
import { loadCountries, searchCountries } from "@/lib/countries";

type Props = {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  mode: "nationality" | "dial";
  onChange: (value: string, country: CountryOption) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function CountrySearchSelect({
  id,
  label,
  hint,
  error,
  value,
  mode,
  onChange,
  disabled,
  className,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = useMemo(() => {
    if (!countries.length) return null;
    return (
      countries.find((c) => (mode === "dial" ? c.dial === value : c.code === value)) ??
      countries[0]
    );
  }, [countries, mode, value]);

  const filtered = useMemo(
    () => searchCountries(countries, query).slice(0, 80),
    [countries, query]
  );

  const triggerLabel = selected
    ? mode === "dial"
      ? `${selected.flag} ${selected.dial}`
      : `${selected.flag} ${selected.name}`
    : "Seçiniz";

  const trigger = (
      <div ref={rootRef} className="relative">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !countries.length}
          className={cn(
            "h-9 w-full justify-between font-normal",
            mode === "dial" && "w-[7.75rem] shrink-0 px-2.5",
            triggerClassName
          )}
          aria-expanded={open}
          aria-label={label || "Ülke seçimi"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>

        {open ? (
          <div className="absolute left-0 z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ülke ara..."
                className="h-9 pl-8"
                autoFocus
              />
            </div>
            <ul className="max-h-56 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <li className="px-2 py-3 text-center text-sm text-muted-foreground">Sonuç yok</li>
              ) : (
                filtered.map((c) => {
                  const itemValue = mode === "dial" ? c.dial : c.code;
                  const active = itemValue === value;
                  return (
                    <li key={`${c.code}-${c.dial}`}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                          active && "bg-muted"
                        )}
                        onClick={() => {
                          onChange(itemValue, c);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span aria-hidden>{c.flag}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                        {mode === "dial" ? (
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {c.dial}
                          </span>
                        ) : null}
                        {active ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
  );

  if (!label) {
    return <div className={className}>{trigger}</div>;
  }

  return (
    <FormField id={id ?? label} label={label} hint={hint} error={error} className={className}>
      {trigger}
    </FormField>
  );
}
