"use client";

import { CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Form adımlarında mobilde yapışkan, tam genişlik buton satırı */
export function FormStepFooter({ children, className }: Props) {
  return (
    <CardFooter
      className={cn(
        "form-step-footer border-t flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:flex-wrap sm:items-center",
        className
      )}
    >
      {children}
    </CardFooter>
  );
}

export function formStepButtonClass(className?: string) {
  return cn("w-full sm:w-auto min-h-11 touch-manipulation", className);
}
