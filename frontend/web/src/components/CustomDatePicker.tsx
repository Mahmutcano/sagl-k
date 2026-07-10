"use client";

import React, { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  id: string;
  label?: string;
  placeholder?: string;
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  className?: string;
  error?: string;
  hint?: string;
  maxDate?: string;
  minDate?: string;
  yearSelect?: boolean;
};

const MONTH_NAMES = [
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

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

function toDisplayFormat(val: string): string {
  if (!val) return "";
  const parts = val.split("-");
  if (parts.length !== 3) return val;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function toIsoFormat(val: string): string {
  const parts = val.split(".");
  if (parts.length !== 3) return "";
  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  const year = parts[2];
  if (year.length !== 4) return "";
  return `${year}-${month}-${day}`;
}

function parseIso(val?: string): Date | null {
  if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return null;
  const d = new Date(`${val}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function toIsoLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export function CustomDatePicker({
  id,
  label,
  placeholder = "GG.AA.YYYY",
  value,
  onChange,
  className,
  error,
  hint,
  maxDate,
  minDate,
  yearSelect = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(toDisplayFormat(value));

  const max = parseIso(maxDate) ?? null;
  const min = parseIso(minDate) ?? null;

  const [navDate, setNavDate] = useState(() => {
    const fromValue = parseIso(value);
    if (fromValue) return fromValue;
    if (max) return max;
    return new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(toDisplayFormat(value));
    const d = parseIso(value);
    if (d) setNavDate(d);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function isDisabledDay(day: number): boolean {
    const d = new Date(navDate.getFullYear(), navDate.getMonth(), day, 12);
    if (max && d > max) return true;
    if (min && d < min) return true;
    return false;
  }

  function commitIso(iso: string) {
    const d = parseIso(iso);
    if (!d) {
      onChange("");
      return;
    }
    if (max && d > max) return;
    if (min && d < min) return;
    onChange(iso);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9.]/g, "");
    if (val.length === 2 && !val.includes(".")) val = `${val}.`;
    else if (val.length === 5 && val.split(".").length === 2) val = `${val}.`;
    if (val.length > 10) val = val.substring(0, 10);
    setInputValue(val);
    if (val.length === 10) {
      const iso = toIsoFormat(val);
      if (iso) commitIso(iso);
    } else if (val === "") {
      onChange("");
    }
  };

  const handleInputBlur = () => {
    if (inputValue !== "" && inputValue.length < 10) {
      setInputValue(toDisplayFormat(value));
    }
  };

  const prevMonth = () => setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() - 1, 1));
  const nextMonth = () => setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() + 1, 1));

  const selectDay = (day: number) => {
    if (isDisabledDay(day)) return;
    const d = new Date(navDate.getFullYear(), navDate.getMonth(), day, 12);
    const iso = toIsoLocal(d);
    commitIso(iso);
    setInputValue(toDisplayFormat(iso));
    setIsOpen(false);
  };

  const year = navDate.getFullYear();
  const month = navDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstDayIndex = new Date(year, month, 1).getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const activeDate = parseIso(value);
  const isSelected = (day: number) =>
    !!activeDate &&
    activeDate.getDate() === day &&
    activeDate.getMonth() === month &&
    activeDate.getFullYear() === year;

  const maxYear = max?.getFullYear() ?? new Date().getFullYear();
  const minYear = min?.getFullYear() ?? maxYear - 100;
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  return (
    <div ref={containerRef} className={cn("relative flex w-full flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold leading-none text-foreground">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="h-10 rounded-xl bg-white pr-20 text-sm focus-visible:border-primary focus-visible:ring-primary/20"
        />

        <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
          {inputValue ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setInputValue("");
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
              aria-label="Tarihi temizle"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
            aria-label="Takvimi aç"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-[min(100vw-2rem,20rem)] rounded-2xl border bg-white p-3 shadow-2xl sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Önceki ay"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {yearSelect ? (
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                <select
                  className="h-8 min-w-0 flex-1 rounded-lg border bg-white px-2 text-xs font-semibold"
                  value={month}
                  onChange={(e) => setNavDate(new Date(year, Number(e.target.value), 1))}
                  aria-label="Ay"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  className="h-8 w-[5.5rem] shrink-0 rounded-lg border bg-white px-2 text-xs font-semibold"
                  value={year}
                  onChange={(e) => setNavDate(new Date(Number(e.target.value), month, 1))}
                  aria-label="Yıl"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs font-bold tracking-wide text-foreground">
                {MONTH_NAMES[month]} {year}
              </span>
            )}

            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Sonraki ay"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="py-1 text-[10px] font-bold uppercase text-muted-foreground">
                {wd}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
              const selected = isSelected(day);
              const disabled = isDisabledDay(day);
              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  className={cn(
                    "flex h-8 w-full items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                    disabled && "cursor-not-allowed text-muted-foreground",
                    !disabled && selected && "bg-primary text-primary-foreground",
                    !disabled && !selected && "text-foreground hover:bg-muted"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
