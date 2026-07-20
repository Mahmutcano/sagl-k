"use client";

import { CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  /** Sol: Geri */
  back?: React.ReactNode;
  /** Sağ: Devam et / birincil eylem */
  primary?: React.ReactNode;
  /** Geriye uyumluluk — tercih: back + primary */
  children?: React.ReactNode;
  className?: string;
};

/**
 * Form adımı alt çubuğu — standart: Geri solda, Devam et sağda.
 * Mobilde de aynı hizalama (hasta yormayan kısa etiketlerle kullanılır).
 */
export function FormStepFooter({ back, primary, children, className }: Props) {
  const useSlots = back != null || primary != null;

  return (
    <CardFooter
      className={cn(
        "form-step-footer border-t pt-4",
        useSlots
          ? "flex flex-row items-center justify-between gap-3"
          : "flex flex-row flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      {useSlots ? (
        <>
          <div className="form-step-footer-back flex min-w-0 shrink-0 justify-start">
            {back ?? <span />}
          </div>
          <div className="form-step-footer-primary flex min-w-0 shrink-0 justify-end">
            {primary ?? null}
          </div>
        </>
      ) : (
        children
      )}
    </CardFooter>
  );
}

export function formStepButtonClass(className?: string) {
  return cn("min-h-11 touch-manipulation px-5", className);
}
