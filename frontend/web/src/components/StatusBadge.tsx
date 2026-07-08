import { STATUS_LABELS, staffStatusLabel, statusVariant } from "@/lib/application";
import { Badge } from "@/components/ui/badge";

type Props = {
  code: number;
  /** patient: hasta metinleri (ödeme dahil). staff: hekim/sekreterya metinleri */
  audience?: "patient" | "staff";
};

export function StatusBadge({ code, audience = "patient" }: Props) {
  const label =
    audience === "staff" ? staffStatusLabel(code) : (STATUS_LABELS[code] ?? `Durum ${code}`);

  return (
    <Badge variant={statusVariant(code)} className="shrink-0">
      {label}
    </Badge>
  );
}
