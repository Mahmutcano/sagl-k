"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const MONTHS = [
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

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, day] = value.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return d;
}

function formatDisplay(value?: string) {
  const d = parseISO(value);
  if (!d) return "";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildGrid(view: Date) {
  const first = startOfMonth(view);
  // Monday-first: JS getDay() Sun=0 … Sat=6 → Mon=0 … Sun=6
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const cell = new Date(start);
    cell.setDate(start.getDate() + i);
    cells.push(cell);
  }
  return cells;
}

type DatePickerProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id" | "onChange"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  name?: string;
  min?: string;
  max?: string;
};

export function DatePicker({
  id,
  label,
  hint,
  error,
  fieldClassName,
  value,
  defaultValue,
  onChange,
  name,
  min,
  max,
  disabled,
}: DatePickerProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(String(defaultValue ?? ""));
  const current = isControlled ? String(value ?? "") : internal;

  const selected = parseISO(current);
  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selected ?? today);

  useEffect(() => {
    if (selected) setView(startOfMonth(selected));
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const minDate = parseISO(min);
  const maxDate = parseISO(max);
  const cells = useMemo(() => buildGrid(view), [view]);

  function commit(d: Date) {
    const iso = toISO(d);
    if (!isControlled) setInternal(iso);
    onChange?.({ target: { value: iso, name: name ?? id } });
    setOpen(false);
  }

  function isDisabled(d: Date) {
    if (minDate && d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  }

  function shiftMonth(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  function shiftYear(delta: number) {
    setView((v) => new Date(v.getFullYear() + delta, v.getMonth(), 1));
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  const display = formatDisplay(current);

  return (
    <div
      role="group"
      className={fieldClassName ? `field ${fieldClassName}` : "field"}
      data-invalid={error ? true : undefined}
    >
      <label htmlFor={id}>{label}</label>
      <div ref={rootRef} className="datepicker relative w-full">
        <button
          type="button"
          id={id}
          className="datepicker-trigger flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-sm font-medium shadow-xs transition-[color,box-shadow] hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onTriggerKey}
        >
          <CalendarIcon className="size-4 shrink-0 text-primary opacity-90" />
          <span className={`flex-1 truncate text-start ${display ? "" : "text-muted-foreground"}`}>
            {display || "GG.AA.YYYY"}
          </span>
          <ChevronDownIcon
            className={`size-4 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        <div
          id={listboxId}
          role="dialog"
          aria-modal="false"
          aria-label="Takvim"
          data-popover
          aria-hidden={!open}
          data-side="bottom"
          className="datepicker-popover"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="btn"
                  data-variant="ghost"
                  data-size="icon-sm"
                  aria-label="Önceki yıl"
                  onClick={() => shiftYear(-1)}
                >
                  <span className="text-xs font-bold tracking-tighter">«</span>
                </button>
                <button
                  type="button"
                  className="btn"
                  data-variant="ghost"
                  data-size="icon-sm"
                  aria-label="Önceki ay"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeftIcon className="size-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1 text-center text-sm font-bold tracking-tight">
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="btn"
                  data-variant="ghost"
                  data-size="icon-sm"
                  aria-label="Sonraki ay"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRightIcon className="size-4" />
                </button>
                <button
                  type="button"
                  className="btn"
                  data-variant="ghost"
                  data-size="icon-sm"
                  aria-label="Sonraki yıl"
                  onClick={() => shiftYear(1)}
                >
                  <span className="text-xs font-bold tracking-tighter">»</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((d) => {
                const inMonth = d.getMonth() === view.getMonth();
                const iso = toISO(d);
                const isSelected = current === iso;
                const isToday = toISO(today) === iso;
                const disabledDay = isDisabled(d);
                return (
                  <button
                    key={iso + String(inMonth)}
                    type="button"
                    disabled={disabledDay}
                    onClick={() => commit(d)}
                    className={[
                      "datepicker-day relative flex h-9 items-center justify-center rounded-md text-sm font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      !inMonth ? "text-muted-foreground/45" : "",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-accent hover:text-accent-foreground",
                      isToday && !isSelected
                        ? "ring-1 ring-primary/40 text-primary"
                        : "",
                      disabledDay ? "pointer-events-none opacity-30" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-selected={isSelected ? "true" : undefined}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={iso}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 border-t pt-2">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                data-size="sm"
                onClick={() => {
                  if (!isDisabled(today)) commit(today);
                }}
              >
                Bugün
              </button>
              <button
                type="button"
                className="btn"
                data-variant="outline"
                data-size="sm"
                onClick={() => {
                  if (!isControlled) setInternal("");
                  onChange?.({ target: { value: "", name: name ?? id } });
                  setOpen(false);
                }}
              >
                Temizle
              </button>
            </div>
          </div>
        </div>

        <input type="hidden" name={name ?? id} value={current} readOnly />
      </div>
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
