import React from "react";
import { Button } from "./button";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Evet, Devam Et",
  cancelText = "Vazgeç",
  variant = "default",
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-lg font-semibold leading-none tracking-tight mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button 
            variant={variant === "destructive" ? "destructive" : "default"} 
            type="button"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
