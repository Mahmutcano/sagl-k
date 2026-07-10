"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_FILE_TYPES, MAX_FILES, validateSelectedFiles } from "@/lib/applicationSurvey";
import { cn } from "@/lib/utils";
import {
  CloudUpload,
  FileImage,
  FileText,
  Paperclip,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  onError?: (message: string) => void;
  error?: string;
  disabled?: boolean;
};

const accept = Object.entries(ACCEPTED_FILE_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts])
  .join(",");

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  return FileText;
}

export function FileUploadField({ files, onChange, onError, error, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const atLimit = files.length >= MAX_FILES;
  const canAdd = !disabled && !atLimit;

  function addFiles(list: FileList | null) {
    if (!list?.length || !canAdd) return;
    const merged = [...files, ...Array.from(list)];
    const unique = merged.filter(
      (f, i, arr) => arr.findIndex((x) => x.name === f.name && x.size === f.size) === i
    );
    const next = unique.slice(0, MAX_FILES);
    const msg = validateSelectedFiles(next);
    if (msg) {
      onError?.(msg);
      return;
    }
    onError?.("");
    onChange(next);
  }

  function removeAt(index: number) {
    const next = files.filter((_, i) => i !== index);
    onChange(next);
    onError?.(validateSelectedFiles(next) ?? "");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!canAdd) return;
    addFiles(e.dataTransfer.files);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary" />
            Tıbbi belgeler
          </p>
          <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
            Tetkik, rapor veya görüntüleme sonuçlarınızı ekleyin (isteğe bağlı)
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-md">
          {files.length}/{MAX_FILES}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        disabled={!canAdd}
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={canAdd ? 0 : -1}
        onClick={() => canAdd && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && canAdd) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (canAdd) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200 outline-none",
          canAdd && "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : canAdd
              ? "border-muted-foreground/25 bg-muted/30 hover:border-primary/40 hover:bg-accent/40"
              : "border-muted bg-muted/40 opacity-60 cursor-not-allowed"
        )}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-primary/5 blur-xl" />

        <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-8 sm:gap-4 sm:px-6 sm:py-10 text-center">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-200",
              dragOver
                ? "scale-110 border-primary/30 bg-primary/10 text-primary"
                : "bg-background text-primary"
            )}
          >
            {dragOver ? (
              <Sparkles className="h-8 w-8 animate-pulse" />
            ) : (
              <CloudUpload className="h-8 w-8" />
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-bold text-foreground">
              {dragOver ? "Dosyaları buraya bırakın" : "Belgelerinizi yükleyin"}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm px-2">
              <span className="sm:hidden">Dosya seçin veya buraya sürükleyin</span>
              <span className="hidden sm:inline">Sürükleyip bırakın veya bilgisayarınızdan seçin</span>
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={!canAdd}
            className="pointer-events-none gap-2 rounded-xl font-bold shadow-primary/15 px-5 h-10"
            tabIndex={-1}
          >
            <Upload className="h-4 w-4" />
            Dosya Seç
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {["PDF", "JPEG", "PNG"].map((fmt) => (
              <span
                key={fmt}
                className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground bg-white border px-2.5 py-1 rounded-full shadow-sm"
              >
                {fmt}
              </span>
            ))}
            <span className="text-[10px] text-muted-foreground">· max 10 MB</span>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {files.length > 0 ? (
        <ul className="grid gap-2">
          {files.map((file, index) => {
            const Icon = fileIcon(file.type);
            return (
              <li
                key={`${file.name}-${file.size}`}
                className="group flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm hover:border-primary/20 transition-all"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary border border-primary/10">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(index);
                  }}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 opacity-70 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-center text-xs text-muted-foreground italic">
          Henüz dosya eklenmedi — yüklemek zorunlu değildir
        </p>
      )}
    </div>
  );
}
