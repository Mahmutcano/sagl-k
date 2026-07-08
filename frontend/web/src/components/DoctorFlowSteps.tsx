import { Check } from "lucide-react";

export type DoctorFlowStep = "application" | "edit" | "preview";

export function DoctorFlowSteps({ step }: { step: DoctorFlowStep }) {
  const steps: { id: DoctorFlowStep; label: string }[] = [
    { id: "application", label: "Başvuru İnceleme" },
    { id: "edit", label: "Rapor Yazımı" },
    { id: "preview", label: "Önizleme ve Onay" },
  ];

  const currentIdx = steps.findIndex((s) => s.id === step);

  return (
    <div className="hidden md:flex flex-wrap items-center gap-2 text-xs font-semibold">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <span key={s.id} className="flex items-center gap-2">
            {i > 0 ? <span className="text-slate-300">→</span> : null}
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                active
                  ? "bg-primary text-white border-primary"
                  : done
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-400 border-slate-200"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              {s.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
