import { STATUS_LABELS, statusVariant } from "@/lib/application";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ code }: { code: number }) {
  return (
    <Badge variant={statusVariant(code)} className="shrink-0">
      {STATUS_LABELS[code] ?? `Durum ${code}`}
    </Badge>
  );
}
