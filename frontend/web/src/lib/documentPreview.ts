/** Resmi HTML belgeleri (başvuru formu, rapor) açma / indirme / yazdırma */

export function openHtmlDocument(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  return true;
}

export function downloadHtmlDocument(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function printHtmlDocumentSync(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return true;
}

export function previewDownloadFilename(prefix: string, applicationId: string): string {
  const short = applicationId.replace(/-/g, "").slice(0, 8);
  return `${prefix}-${short}.html`;
}
