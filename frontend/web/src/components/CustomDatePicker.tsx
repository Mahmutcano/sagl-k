"use client";

import React, { useState, useRef, useEffect } from "react";
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
};

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

// Helper to format YYYY-MM-DD to DD.MM.YYYY
function toDisplayFormat(val: string): string {
  if (!val) return "";
  const parts = val.split("-");
  if (parts.length !== 3) return val;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

// Helper to parse DD.MM.YYYY to YYYY-MM-DD
function toIsoFormat(val: string): string {
  const parts = val.split(".");
  if (parts.length !== 3) return "";
  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  const year = parts[2];
  if (year.length !== 4) return "";
  return `${year}-${month}-${day}`;
}

export function CustomDatePicker({
  id,
  label,
  placeholder = "GG.AA.YYYY",
  value,
  onChange,
  className
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(toDisplayFormat(value));
  
  // Calendar navigation state
  const [navDate, setNavDate] = useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state if external value changes
  useEffect(() => {
    setInputValue(toDisplayFormat(value));
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setNavDate(d);
      }
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9.]/g, ""); // Allow only digits and dots
    
    // Auto dot insertion
    if (val.length === 2 && !val.includes(".")) {
      val = val + ".";
    } else if (val.length === 5 && val.split(".").length === 2) {
      val = val + ".";
    }

    // Limit length to 10 characters (DD.MM.YYYY)
    if (val.length > 10) {
      val = val.substring(0, 10);
    }

    setInputValue(val);

    // If fully typed, try parsing and calling onChange
    if (val.length === 10) {
      const iso = toIsoFormat(val);
      if (iso) {
        onChange(iso);
      }
    } else if (val === "") {
      onChange("");
    }
  };

  const handleInputBlur = () => {
    // If invalid on blur, reset to current value
    if (inputValue !== "" && inputValue.length < 10) {
      setInputValue(toDisplayFormat(value));
    }
  };

  // Month navigation
  const prevMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() + 1, 1));
  };

  // Day selection
  const selectDay = (day: number) => {
    const d = new Date(navDate.getFullYear(), navDate.getMonth(), day);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    const iso = `${year}-${month}-${date}`;
    onChange(iso);
    setInputValue(`${date}.${month}.${year}`);
    setIsOpen(false);
  };

  // Calendar calculations
  const year = navDate.getFullYear();
  const month = navDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Weekday of 1st day (0 = Monday, ..., 6 = Sunday)
  let firstDayIndex = new Date(year, month, 1).getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6; // Sunday adjust

  const days = [];
  // Empty slots for leading days
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Selected date parsed
  const activeDate = value ? new Date(value) : null;
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

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-1.5 w-full", className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-slate-700 tracking-wide">
          {label}
        </label>
      )}
      
      <div className="relative">
        <CalendarIcon
          onClick={() => setIsOpen(!isOpen)}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
        />
        
        <Input
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10 pr-9 h-10 border-slate-200 focus-visible:ring-primary/20 focus-visible:border-primary bg-white rounded-xl shadow-inner-sm text-sm"
        />

        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 rounded-full p-0.5 hover:bg-slate-100 transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Popover Calendar Grid */}
      {isOpen && (
        <div className="absolute top-[105%] left-0 z-50 mt-1 w-[280px] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 tracking-wide">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="text-[10px] font-bold text-slate-400 uppercase py-1">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }
              const selected = isSelected(day);
              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all duration-100",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
