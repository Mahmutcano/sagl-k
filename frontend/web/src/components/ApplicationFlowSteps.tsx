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
    <nav aria-label="Başvuru adımları" className="mb-5 sm:mb-6">
      <ol className="flex w-full items-stretch gap-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FLOW_STEPS.map((step, index) => {
          const done =
            index < currentIndex || (paymentComplete && step.key === "payment");
          const active =
            step.key === current && !(paymentComplete && step.key === "payment");

          return (
            <li
              key={step.key}
              className={cn(
                "relative flex min-w-[4.75rem] flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2.5 sm:min-w-0 sm:px-3",
                active && "bg-primary text-primary-foreground",
                done && !active && "bg-slate-50",
                !done && !active && "text-slate-500"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  active && "bg-white/20 text-primary-foreground",
                  done && !active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-slate-100 text-slate-500"
                )}
                aria-current={active ? "step" : undefined}
              >
                {done && !active ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "truncate text-[11px] font-medium leading-tight sm:text-sm",
                  active && "font-semibold text-primary-foreground",
                  done && !active && "text-slate-700",
                  !done && !active && "text-slate-500"
                )}
              >
                {compact ? (
                  step.short
                ) : (
                  <>
                    <span className="sm:hidden">{step.short}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </>
                )}
              </span>
              {index < FLOW_STEPS.length - 1 ? (
                <span
                  className={cn(
                    "pointer-events-none absolute -right-px top-1/2 hidden h-4 w-px -translate-y-1/2 sm:block",
                    active || done ? "bg-transparent" : "bg-slate-200"
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
    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:text-sm">
      <span className="font-medium text-slate-800">Adım {index + 1}/4 — {step?.label}</span>
      {next ? (
        <>
          {" · "}
          Sıradaki: <span className="font-medium text-slate-800">{next.label}</span>
        </>
      ) : (
        <> · Son adım</>
      )}
    </p>
  );
}
