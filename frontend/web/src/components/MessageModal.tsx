"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MessageModalProps = {
  title?: string;
  message: string;
  variant?: "destructive" | "default" | "success";
  open?: boolean;
  onClose?: () => void;
};

export function MessageModal({
  title,
  message,
  variant = "destructive",
  open: controlledOpen,
  onClose,
}: MessageModalProps) {
  const titleId = useId();
  const [internalOpen, setInternalOpen] = useState(Boolean(message));
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  useEffect(() => {
    if (!isControlled && message) setInternalOpen(true);
  }, [message, title, variant, isControlled]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function handleClose() {
    if (!isControlled) setInternalOpen(false);
    onClose?.();
  }

  if (!open || !message) return null;

  const Icon =
    variant === "success" ? CheckCircle2 : variant === "default" ? Info : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center sm:p-6">
      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={handleClose} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
          "max-h-[min(85vh,640px)]"
        )}
      >
        <div
          className={cn(
            "flex items-start gap-3 border-b px-5 py-4 sm:px-6 sm:py-5",
            variant === "destructive" && "border-destructive/20 bg-destructive/5",
            variant === "success" && "border-emerald-200 bg-emerald-50/80",
            variant === "default" && "border-border bg-muted/40"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
              variant === "destructive" && "bg-destructive/10 text-destructive",
              variant === "success" && "bg-emerald-100 text-emerald-700",
              variant === "default" && "bg-primary/10 text-primary"
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h3 id={titleId} className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {title || (variant === "destructive" ? "Hata" : variant === "success" ? "Başarılı" : "Bilgi")}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={handleClose}
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90 sm:text-base">
            {message}
          </p>
        </div>

        <div className="flex justify-end border-t bg-muted/20 px-5 py-4 sm:px-6">
          <Button type="button" className="min-w-[7.5rem]" onClick={handleClose}>
            Tamam
          </Button>
        </div>
      </div>
    </div>
  );
}
