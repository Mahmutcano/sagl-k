"use client";

import { Button } from "@/components/ui/button";
import { ACCEPTED_FILE_TYPES, MAX_FILES, validateSelectedFiles } from "@/lib/applicationSurvey";

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

export function FileUploadField({ files, onChange, onError, error, disabled }: Props) {
  function addFiles(list: FileList | null) {
    if (!list?.length) return;
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

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium">Tıbbi belgeler</p>
        <p className="text-muted-foreground text-sm">
          Tetkik, rapor, görüntüleme sonuçları (PDF, JPEG, PNG — dosya başına en fazla 10 MB, en
          fazla {MAX_FILES} dosya)
        </p>
      </div>
      <input
        type="file"
        multiple
        accept={accept}
        disabled={disabled || files.length >= MAX_FILES}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {files.length > 0 ? (
        <ul className="grid gap-2 rounded-lg border p-3">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">
                {file.name}{" "}
                <span className="text-muted-foreground">({formatSize(file.size)})</span>
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeAt(index)}>
                Kaldır
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Henüz dosya seçilmedi (isteğe bağlı).</p>
      )}
    </div>
  );
}
