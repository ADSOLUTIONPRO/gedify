type FileTypeBadgeProps = {
  fileName?: string | null;
  mimeType?: string | null;
  className?: string;
};

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/webp": "WEBP",
  "image/heic": "HEIC",
  "image/tiff": "TIFF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "message/rfc822": "EML",
};

const TONE_BY_LABEL: Record<string, string> = {
  PDF: "bg-rose-50 text-rose-700 ring-rose-200",
  PNG: "bg-sky-50 text-sky-700 ring-sky-200",
  JPG: "bg-sky-50 text-sky-700 ring-sky-200",
  WEBP: "bg-sky-50 text-sky-700 ring-sky-200",
  TIFF: "bg-sky-50 text-sky-700 ring-sky-200",
  HEIC: "bg-sky-50 text-sky-700 ring-sky-200",
  DOC: "bg-blue-50 text-blue-700 ring-blue-200",
  DOCX: "bg-blue-50 text-blue-700 ring-blue-200",
  XLS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  XLSX: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  TXT: "bg-slate-50 text-slate-700 ring-slate-200",
  MD: "bg-slate-50 text-slate-700 ring-slate-200",
  EML: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function resolveFileTypeLabel(fileName?: string | null, mimeType?: string | null) {
  if (mimeType && MIME_LABELS[mimeType.toLowerCase()]) {
    return MIME_LABELS[mimeType.toLowerCase()];
  }

  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext) {
      return ext.toUpperCase().slice(0, 5);
    }
  }

  return "FICHIER";
}

export function FileTypeBadge({ fileName, mimeType, className = "" }: FileTypeBadgeProps) {
  const label = resolveFileTypeLabel(fileName, mimeType);
  const tone = TONE_BY_LABEL[label] ?? "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${tone} ${className}`}
    >
      {label}
    </span>
  );
}
