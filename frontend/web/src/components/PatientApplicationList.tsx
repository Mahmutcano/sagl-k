"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{item.professionName ?? "Başvuru"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Başvuru no: {applicationDisplayNumber(item)}
            {item.doctorName ? ` · ${item.doctorName}` : ""}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </p>
          {isPatientAwaitingDoctor(item.statusCode) ? (
            <p className="text-xs text-muted-foreground">Doktorunuz tarafından raporlanıyor</p>
          ) : null}
        </div>
        <StatusBadge code={item.statusCode} />
      </CardHeader>
      <CardFooter className="flex flex-wrap justify-end gap-2 border-t pt-4">
        {canEdit ? (
          <>
            <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
              <Link href={ROUTES.patient.editApplication(item.applicationId, "details")}>
                Bölüm / doktor
              </Link>
            </Button>
            <Button size="sm" asChild className="w-full sm:w-auto">
              <Link href={ROUTES.patient.editApplication(item.applicationId)}>Devam et</Link>
            </Button>
          </>
        ) : null}
        <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
          <Link href={ROUTES.patient.application(item.applicationId)}>Detay</Link>
        </Button>
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
      </CardFooter>
    </Card>
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
        <p className="text-sm text-muted-foreground">{description}</p>
        {stepHint ? (
          <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {stepHint}
          </p>
        ) : null}
      </div>
      <ul className="grid gap-3">{children}</ul>
    </section>
  );
}
