"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  applicationDisplayNumber,
  isPatientCancellableStatus,
  isPatientEditableStatus,
  isPatientAwaitingDoctor,
} from "@/lib/application";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export type ApplicationListItem = {
  applicationId: string;
  applicationNumber?: string;
  statusCode: number;
  ecommerceNumber?: string;
  professionName?: string;
  createdAt: string;
};

type Props = {
  item: ApplicationListItem;
  onDelete?: (id: string) => void;
  deleting?: boolean;
};

export function PatientApplicationRow({ item, onDelete, deleting }: Props) {
  const canDelete = isPatientCancellableStatus(item.statusCode);
  const canEdit = isPatientEditableStatus(item.statusCode);
  const dateLabel = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("tr-TR")
    : "";

  return (
    <div className="interactive-card rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Link
          href={ROUTES.patient.application(item.applicationId)}
          className="min-w-0 flex-1 space-y-1 hover:text-primary"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold leading-tight">{item.professionName ?? "Başvuru"}</p>
            <StatusBadge code={item.statusCode} />
          </div>
          <p className="text-muted-foreground text-sm">
            Başvuru no: {applicationDisplayNumber(item)}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </p>
          {isPatientAwaitingDoctor(item.statusCode) ? (
            <p className="text-muted-foreground text-xs mt-1">
              Doktorunuz tarafından raporlanıyor
            </p>
          ) : null}
        </Link>
        <div className="mobile-action-stack flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:w-auto">
          {canEdit ? (
            <>
              <Button size="sm" variant="secondary" asChild className="w-full sm:w-auto">
                <Link href={ROUTES.patient.editApplication(item.applicationId)}>Devam et</Link>
              </Button>
              <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
                <Link href={ROUTES.patient.editApplication(item.applicationId, "details")}>
                  Bölüm ve doktoru değiştir
                </Link>
              </Button>
            </>
          ) : null}
          {canDelete && onDelete ? (
            <Button
              size="sm"
              variant="destructive"
              type="button"
              className="w-full sm:w-auto"
              disabled={deleting}
              onClick={() => onDelete(item.applicationId)}
            >
              {deleting ? "Siliniyor..." : "Sil"}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
            <Link href={ROUTES.patient.application(item.applicationId)}>Detay</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

type GroupProps = {
  title: string;
  description: string;
  stepHint?: string;
  children: React.ReactNode;
  className?: string;
};

export function ApplicationListGroup({
  title,
  description,
  stepHint,
  children,
  className,
}: GroupProps) {
  return (
    <section className={cn("grid gap-3", className)}>
      <div className="space-y-1 border-b pb-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
        {stepHint ? (
          <p className="text-muted-foreground rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs">
            {stepHint}
          </p>
        ) : null}
      </div>
      <ul className="grid gap-3">{children}</ul>
    </section>
  );
}
