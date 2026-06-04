import Image from "next/image";
import { FileText } from "lucide-react";
import { FileTypeBadge } from "@/components/ui/file-type-badge";

type DocumentPreviewProps = {
  documentId: number | string;
  title?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  showBadge?: boolean;
  className?: string;
};

const SIZE_PRESETS = {
  xs: { wrapper: "h-12 w-9", img: { width: 48, height: 64 } },
  sm: { wrapper: "h-20 w-16", img: { width: 80, height: 110 } },
  md: { wrapper: "h-28 w-24", img: { width: 120, height: 160 } },
  lg: { wrapper: "h-44 w-36", img: { width: 220, height: 300 } },
} as const;

export function DocumentPreview({
  documentId,
  title,
  fileName,
  mimeType,
  size = "md",
  showBadge = true,
  className = "",
}: DocumentPreviewProps) {
  const preset = SIZE_PRESETS[size];
  const altText = `Aperçu de ${title || `document ${documentId}`}`;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl border border-slate-200/80 shadow-sm ${preset.wrapper} ${className}`}
      style={{ background: "#f4f0e8" }}
    >
      <Image
        src={`/api/paperless/documents/${documentId}/thumb`}
        alt={altText}
        width={preset.img.width}
        height={preset.img.height}
        loading="lazy"
        className="h-full w-full object-contain object-top"
        unoptimized
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 opacity-0 transition-opacity"
      >
        <FileText className="h-8 w-8 text-blue-300" strokeWidth={1.25} />
      </div>

      {showBadge ? (
        <span className="pointer-events-none absolute left-1.5 top-1.5">
          <FileTypeBadge fileName={fileName} mimeType={mimeType} />
        </span>
      ) : null}
    </div>
  );
}
