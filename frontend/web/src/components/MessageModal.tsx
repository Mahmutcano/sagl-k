"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MessageModalProps = {
  title?: string;
  message: string;
  variant?: "destructive" | "default" | "success";
  open?: boolean;
  onClose?: () => void;
};

export function MessageModal({
  title,
  message,
  variant = "destructive",
  open: controlledOpen,
  onClose,
}: MessageModalProps) {
  const [internalOpen, setInternalOpen] = useState(Boolean(message));
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  useEffect(() => {
    if (!isControlled && message) setInternalOpen(true);
  }, [message, title, variant, isControlled]);

  function handleClose() {
    if (!isControlled) setInternalOpen(false);
    onClose?.();
  }

  if (!message) return null;

  const Icon =
    variant === "success" ? CheckCircle2 : variant === "default" ? Info : AlertTriangle;
  const heading =
    title || (variant === "destructive" ? "Hata" : variant === "success" ? "Başarılı" : "Bilgi");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 shrink-0" />
            {heading}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-foreground">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" className="w-full sm:w-auto" onClick={handleClose}>
            Tamam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
