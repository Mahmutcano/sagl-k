"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  forRelative?: boolean;
  relativeName?: string;
  professionName?: string;
  doctorName?: string;
  className?: string;
};

export function ApplicationContextCard({
  forRelative,
  relativeName,
  professionName,
  doctorName,
  className,
}: Props) {
  const who = forRelative
    ? relativeName?.trim()
      ? `Yakın: ${relativeName}`
      : "Yakın adına başvuru"
    : "Kendi adıma başvuru";

  return (
    <Card className={cn("border-primary/20 bg-muted/40", className)}>
      <CardContent className="flex flex-col gap-1.5 p-3 text-sm sm:p-4">
        <p className="font-medium leading-snug text-foreground">{who}</p>
        {professionName ? (
          <p className="leading-snug text-muted-foreground">
            Bölüm: <span className="text-foreground">{professionName}</span>
          </p>
        ) : null}
        {doctorName ? (
          <p className="leading-snug text-muted-foreground">
            Uzman: <span className="text-foreground">{doctorName}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
