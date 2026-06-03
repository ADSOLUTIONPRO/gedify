"use client";

import Link from "next/link";
import { PenLine } from "lucide-react";

type Variant = "outline" | "soft" | "menu" | "icon";

type Props = {
  documentId: number;
  /** Conservé pour compat d'appel (le titre est résolu dans la page éditeur). */
  title?: string;
  mimeType?: string | null;
  variant?: Variant;
  className?: string;
};

function isPdf(mimeType?: string | null): boolean {
  return (mimeType ?? "").toLowerCase().includes("pdf");
}

/**
 * Bouton « Signer le document » — visible uniquement pour les PDF. Ouvre
 * l'éditeur de signature plein écran (`/documents/[id]/signer`).
 */
export function SignDocumentButton({ documentId, mimeType, variant = "outline", className }: Props) {
  if (!isPdf(mimeType)) return null;
  const href = `/documents/${documentId}/signer`;

  if (variant === "menu") {
    return (
      <Link href={href} onClick={(e) => e.stopPropagation()} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-semibold hover:bg-[#FCFAF7] ${className ?? ""}`} style={{ color: "var(--text-main)" }}>
        <PenLine className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} style={{ color: "var(--accent)" }} aria-hidden="true" /> Signer le document
      </Link>
    );
  }
  if (variant === "icon") {
    return (
      <Link href={href} aria-label="Signer le document" title="Signer le document" className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-white/10 ${className ?? ""}`} style={{ borderColor: "rgba(255,255,255,0.25)", color: "#fff" }}>
        <PenLine className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
      </Link>
    );
  }
  if (variant === "soft") {
    return (
      <Link href={href} className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-bold transition hover:opacity-90 ${className ?? ""}`} style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        <PenLine className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> Signer le document
      </Link>
    );
  }
  return (
    <Link href={href} className={`inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold transition hover:bg-slate-50 ${className ?? ""}`} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
      <PenLine className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> Signer le document
    </Link>
  );
}
