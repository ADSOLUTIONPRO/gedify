"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FileText, Loader2, X } from "lucide-react";
import { FileTypeBadge } from "@/components/ui/file-type-badge";

type DocMeta = {
  title?: string | null;
  mime_type?: string | null;
  original_file_name?: string | null;
  correspondent__name?: string | null;
  document_type__name?: string | null;
};

/**
 * Aperçu d'un document lié à une ligne finance, en popup modale (§8/§9).
 * Aperçu PDF (iframe) / image (img) ; sinon carte d'infos + téléchargement.
 */
export function FinanceDocPreviewModal({ documentId, onClose }: { documentId: number; onClose: () => void }) {
  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/paperless/documents/${documentId}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DocMeta | null) => { if (!cancelled) { setMeta(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [documentId]);

  const mime = meta?.mime_type ?? "";
  const isPdf = mime.toLowerCase().includes("pdf");
  const isImage = mime.toLowerCase().startsWith("image/");
  const previewUrl = `/api/paperless/documents/${documentId}/preview`;
  const downloadUrl = `/api/paperless/documents/${documentId}/download`;
  const fileName = meta?.original_file_name ?? meta?.title ?? null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Aperçu du document">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" style={{ border: "1px solid var(--border)" }}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: "var(--border)", background: "#FCFAF7" }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-hint)" }}>Document lié</p>
            <h2 className="truncate text-[14.5px] font-extrabold" style={{ color: "var(--text-main)" }} title={meta?.title ?? ""}>{meta?.title ?? `Document #${documentId}`}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              <FileTypeBadge fileName={fileName} mimeType={mime} />
              {meta?.correspondent__name ? <span>{meta.correspondent__name}</span> : null}
              {meta?.document_type__name ? <span>· {meta.document_type__name}</span> : null}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Aperçu */}
        <div className="flex-1 overflow-auto bg-slate-50 p-3">
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} /></div>
          ) : isPdf ? (
            <iframe src={previewUrl} title="Aperçu PDF" className="h-[60vh] w-full rounded-lg border bg-white" style={{ borderColor: "var(--border)" }} />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={meta?.title ?? ""} className="mx-auto max-h-[60vh] rounded-lg border bg-white object-contain" style={{ borderColor: "var(--border)" }} />
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border bg-white text-center" style={{ borderColor: "var(--border)" }}>
              <FileText className="h-9 w-9" style={{ color: "var(--text-hint)" }} strokeWidth={1.5} />
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>Aperçu non disponible pour ce type de fichier.</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Téléchargez-le ou ouvrez-le dans Gedify.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <a href={downloadUrl} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            <Download className="h-4 w-4" strokeWidth={1.85} /> Télécharger
          </a>
          <Link href={`/documents/${documentId}`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold text-white" style={{ background: "var(--accent)" }}>
            <ExternalLink className="h-4 w-4" strokeWidth={1.85} /> Ouvrir le document complet
          </Link>
        </div>
      </div>
    </div>
  );
}
