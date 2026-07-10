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
      <ol className="flex w-full gap-1 overflow-x-auto rounded-md border bg-card p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FLOW_STEPS.map((step, index) => {
          const done =
            index < currentIndex || (paymentComplete && step.key === "payment");
          const active =
            step.key === current && !(paymentComplete && step.key === "payment");

          return (
            <li
              key={step.key}
              className={cn(
                "flex min-w-[4.5rem] flex-1 items-center justify-center gap-2 rounded-sm px-2 py-2 text-xs sm:text-sm",
                active && "bg-primary text-primary-foreground",
                done && !active && "bg-secondary text-secondary-foreground",
                !done && !active && "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  active && "bg-primary-foreground/20",
                  done && !active && "bg-background",
                  !done && !active && "bg-muted"
                )}
                aria-current={active ? "step" : undefined}
              >
                {done && !active ? "✓" : index + 1}
              </span>
              <span className="truncate font-medium">
                {compact ? (
                  step.short
                ) : (
                  <>
                    <span className="sm:hidden">{step.short}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </>
                )}
              </span>
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
    <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:text-sm">
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
