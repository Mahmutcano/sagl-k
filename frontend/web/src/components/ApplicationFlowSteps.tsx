"use client";

import { cn } from "@/lib/utils";

export const FLOW_STEPS = [
  { key: "details", label: "Bölüm & doktor", short: "Bölüm" },
  { key: "survey", label: "Şikayet & belgeler", short: "Şikayet" },
  { key: "preview", label: "Form önizleme", short: "Önizleme" },
  { key: "payment", label: "Ödeme", short: "Ödeme" },
] as const;

export type FlowStepKey = (typeof FLOW_STEPS)[number]["key"];

type Props = {
  current: FlowStepKey;
  paymentComplete?: boolean;
  compact?: boolean;
};

export function ApplicationFlowSteps({ current, paymentComplete, compact }: Props) {
  const currentIndex = FLOW_STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Başvuru adımları" className="mb-4 sm:mb-6">
      <ol className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-0">
        {FLOW_STEPS.map((step, index) => {
          const done =
            index < currentIndex || (paymentComplete && step.key === "payment");
          const active =
            step.key === current && !(paymentComplete && step.key === "payment");
          return (
            <li
              key={step.key}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 text-sm",
                index < FLOW_STEPS.length - 1 && "sm:pr-2"
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:flex-row sm:gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary/10 text-primary ring-2 ring-primary/30",
                    !done && !active && "border-muted-foreground/30 text-muted-foreground"
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={cn(
                    "text-center text-[11px] leading-tight sm:text-sm",
                    active && "font-semibold text-foreground",
                    !active && "text-muted-foreground"
                  )}
                >
                  <span className="sm:hidden">{step.short}</span>
                  <span className="hidden sm:inline">{compact ? step.short : step.label}</span>
                </span>
              </div>
              {index < FLOW_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "hidden h-px flex-1 sm:block",
                    done ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ApplicationFlowHint({ current }: { current: FlowStepKey }) {
  const index = FLOW_STEPS.findIndex((s) => s.key === current);
  const step = FLOW_STEPS[index];
  const next = FLOW_STEPS[index + 1];
  return (
    <p className="text-muted-foreground rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs sm:text-sm">
      <span className="font-medium text-foreground">Adım {index + 1}/4 — {step?.label}</span>
      {next ? (
        <>
          {" · "}
          Sıradaki: <span className="font-medium text-foreground">{next.label}</span>
        </>
      ) : (
        <> · Son adım</>
      )}
    </p>
  );
}
