"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

export function DatePickerField({
  id,
  label,
  value,
  onChange,
  placeholder = "Tarih seçin",
  className,
  min,
  max,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseISO(value);
  const [view, setView] = useState(() => selected ?? new Date());

  useEffect(() => {
    if (selected) setView(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const days = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const first = new Date(y, m, 1);
    // Monday-first
    let startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, iso: toISO(y, m, d) });
    }
    return cells;
  }, [view]);

  const display = selected
    ? selected.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  function disabled(iso: string) {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  return (
    <div ref={rootRef} className={cn("relative space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Button
        id={id}
        type="button"
        variant="outline"
        className={cn(
          "h-10 w-full justify-start gap-2 font-normal",
          !display && "text-muted-foreground"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{display || placeholder}</span>
      </Button>

      {open ? (
        <div className="absolute left-0 z-50 mt-1 w-[min(18.5rem,calc(100vw-2rem))] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold capitalize">
              {view.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((cell, idx) =>
              cell ? (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabled(cell.iso)}
                  className={cn(
                    "h-8 rounded-md text-sm hover:bg-muted disabled:opacity-30",
                    value === cell.iso && "bg-primary text-primary-foreground hover:bg-primary"
                  )}
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                >
                  {cell.day}
                </button>
              ) : (
                <div key={`e-${idx}`} />
              )
            )}
          </div>
          <div className="mt-2 flex justify-between gap-2 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Temizle
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const t = new Date();
                onChange(toISO(t.getFullYear(), t.getMonth(), t.getDate()));
                setOpen(false);
              }}
            >
              Bugün
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
