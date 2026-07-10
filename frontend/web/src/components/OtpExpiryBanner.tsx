"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_OTP_SECONDS = 10 * 60;

type OtpExpiryBannerProps = {
  expiresInSeconds?: number;
  expiresAt?: string;
  /** Change when a new SMS is sent to restart the timer. */
  resetKey?: string | number;
  className?: string;
  onExpired?: () => void;
};

function resolveDeadline(expiresInSeconds?: number, expiresAt?: string): number {
  // Prefer absolute backend expiry so back/forward remounts do not restart the timer.
  if (expiresAt) {
    const t = Date.parse(expiresAt);
    if (!Number.isNaN(t)) return t;
  }
  const sec = expiresInSeconds && expiresInSeconds > 0 ? expiresInSeconds : DEFAULT_OTP_SECONDS;
  return Date.now() + sec * 1000;
}

function formatRemaining(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function OtpExpiryBanner({
  expiresInSeconds,
  expiresAt,
  resetKey = 0,
  className,
  onExpired,
}: OtpExpiryBannerProps) {
  const [deadline, setDeadline] = useState(() => resolveDeadline(expiresInSeconds, expiresAt));
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((resolveDeadline(expiresInSeconds, expiresAt) - Date.now()) / 1000))
  );

  useEffect(() => {
    const next = resolveDeadline(expiresInSeconds, expiresAt);
    setDeadline(next);
    setRemaining(Math.max(0, Math.ceil((next - Date.now()) / 1000)));
    // resetKey bumps only when a new SMS is issued; expiresAt is the source of truth.
  }, [resetKey, expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps -- expiresInSeconds is fallback only when expiresAt missing

  useEffect(() => {
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
    }, 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  useEffect(() => {
    if (remaining === 0) onExpired?.();
  }, [remaining, onExpired]);

  const expired = remaining <= 0;
  const urgent = !expired && remaining <= 60;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm",
        expired
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : urgent
            ? "border-amber-300/80 bg-amber-50 text-amber-950"
            : "border-primary/15 bg-primary/[0.04] text-foreground/85",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Clock className={cn("mt-0.5 h-4 w-4 shrink-0", expired ? "text-destructive" : "text-primary")} />
      <div className="min-w-0 flex-1 space-y-0.5">
        {expired ? (
          <>
            <p className="font-semibold">Doğrulama kodunun süresi doldu</p>
            <p className="text-sm opacity-90">
              Yeni bir kod almak için önceki adıma dönüp SMS’i tekrar gönderin.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">
              Kodun geçerlilik süresi:{" "}
              <span className="font-mono text-base tracking-wide">{formatRemaining(remaining)}</span>
            </p>
            <p className="text-sm opacity-90">
              SMS ile gelen kod sınırlı süre geçerlidir. Süre dolmadan girin.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
