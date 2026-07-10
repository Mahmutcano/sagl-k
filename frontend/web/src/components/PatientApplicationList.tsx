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
  doctorName?: string;
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-semibold leading-tight text-slate-900">
              {item.professionName ?? "Başvuru"}
            </p>
            <p className="text-sm text-slate-500">
              Başvuru no: {applicationDisplayNumber(item)}
              {item.doctorName ? ` · ${item.doctorName}` : ""}
              {dateLabel ? ` · ${dateLabel}` : ""}
            </p>
            {isPatientAwaitingDoctor(item.statusCode) ? (
              <p className="mt-1 text-xs text-slate-500">Doktorunuz tarafından raporlanıyor</p>
            ) : null}
          </div>
          <StatusBadge code={item.statusCode} className="shrink-0" />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          {canEdit ? (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link href={ROUTES.patient.editApplication(item.applicationId, "details")}>
                  Bölüm / doktor
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={ROUTES.patient.editApplication(item.applicationId)}>Devam et</Link>
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" asChild>
            <Link href={ROUTES.patient.application(item.applicationId)}>Detay</Link>
          </Button>
          {canDelete && onDelete ? (
            <Button
              size="sm"
              variant="destructive"
              type="button"
              disabled={deleting}
              onClick={() => onDelete(item.applicationId)}
            >
              {deleting ? "Siliniyor..." : "Sil"}
            </Button>
          ) : null}
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
      <div className="space-y-1 border-b border-slate-200 pb-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
        {stepHint ? (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {stepHint}
          </p>
        ) : null}
      </div>
      <ul className="grid gap-3">{children}</ul>
    </section>
  );
}
