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
  /** Inclusive max date (YYYY-MM-DD). Defaults to none. */
  maxDate?: string;
  /** Inclusive min date (YYYY-MM-DD). Defaults to none. */
  minDate?: string;
  /** Show year/month dropdowns — useful for birth dates. */
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

    if (val.length === 2 && !val.includes(".")) {
      val = val + ".";
    } else if (val.length === 5 && val.split(".").length === 2) {
      val = val + ".";
    }

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

  const prevMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() + 1, 1));
  };

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
  const isSelected = (day: number) => {
    if (!activeDate) return false;
    return (
      activeDate.getDate() === day &&
      activeDate.getMonth() === month &&
      activeDate.getFullYear() === year
    );
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setInputValue("");
  };

  const maxYear = max?.getFullYear() ?? new Date().getFullYear();
  const minYear = min?.getFullYear() ?? maxYear - 100;
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  return (
    <div ref={containerRef} className={cn("relative flex w-full flex-col gap-1", className)}>
      {label ? (
        <label htmlFor={id} className="font-semibold leading-none text-foreground">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <CalendarIcon
          onClick={() => setIsOpen(!isOpen)}
          className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-slate-600"
        />

        <Input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="h-10 rounded-xl border-slate-200 bg-white pl-10 pr-9 text-sm shadow-inner-sm focus-visible:border-primary focus-visible:ring-primary/20"
        />

        {inputValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tarihi temizle"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
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
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-[min(100%,320px)] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg border border-slate-100 p-1.5 text-slate-600 transition-all hover:bg-slate-50"
              aria-label="Önceki ay"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {yearSelect ? (
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
                <select
                  className="max-w-[45%] truncate rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold text-slate-800"
                  value={month}
                  onChange={(e) =>
                    setNavDate(new Date(year, Number(e.target.value), 1))
                  }
                  aria-label="Ay"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  className="max-w-[40%] truncate rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold text-slate-800"
                  value={year}
                  onChange={(e) =>
                    setNavDate(new Date(Number(e.target.value), month, 1))
                  }
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
              <span className="text-xs font-bold tracking-wide text-slate-800">
                {MONTH_NAMES[month]} {year}
              </span>
            )}

            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg border border-slate-100 p-1.5 text-slate-600 transition-all hover:bg-slate-50"
              aria-label="Sonraki ay"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="py-1 text-[10px] font-bold uppercase text-slate-400">
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
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all duration-100",
                    disabled && "cursor-not-allowed text-slate-300",
                    !disabled &&
                      selected &&
                      "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
                    !disabled &&
                      !selected &&
                      "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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
