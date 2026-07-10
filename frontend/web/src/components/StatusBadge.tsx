import { STATUS_LABELS, staffStatusLabel, statusVariant } from "@/lib/application";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  code: number;
  /** patient: hasta metinleri (ödeme dahil). staff: hekim/sekreterya metinleri */
  audience?: "patient" | "staff";
  className?: string;
};

export function StatusBadge({ code, audience = "patient", className }: Props) {
  const label =
    audience === "staff" ? staffStatusLabel(code) : (STATUS_LABELS[code] ?? `Durum ${code}`);

  return (
    <Badge variant={statusVariant(code)} className={cn("shrink-0", className)}>
      {label}
    </Badge>
  );
}
