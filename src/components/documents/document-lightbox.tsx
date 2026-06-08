"use client";

import { useEffect } from "react";
import { Download, ExternalLink, Mail, X } from "lucide-react";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import { SignDocumentButton } from "@/components/documents/sign-document-button";
import type { DocumentVM } from "@/components/documents/types";

const lightAction =
  "inline-flex h-9 items-center gap-1.5 rounded-[20px] border border-white/30 px-3 text-[12.5px] font-bold text-white transition hover:bg-white/15";

/**
 * Lightbox d'aperçu document : grand format (PDF/image via la route preview),
 * fond assombri, titre, actions rapides (Ouvrir / Télécharger / Envoyer par
 * mail / Fermer). N'ouvre PAS la page détail, ne remplace pas la sidebar résumé.
 */
export function DocumentLightbox({ doc, onClose }: { doc: DocumentVM; onClose: () => void }) {
  const previewUrl = `/api/paperless/documents/${doc.id}/preview`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={`Aperçu — ${doc.displayTitle}`}>
      <button type="button" aria-label="Fermer l'aperçu" onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      {/* pt = hauteur de la barre de titre desktop (--titlebar-h, 0 hors desktop) :
          le header du lightbox ne passe jamais sous la titlebar (z-200). */}
      <div className="relative z-10 flex h-full flex-col" style={{ paddingTop: "max(env(safe-area-inset-top, 0px), var(--titlebar-h, 0px))" }}>
        {/* Barre d'actions */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0 truncate text-[14px] font-bold text-white" title={doc.displayTitle}>
            {doc.displayTitle}
          </span>
          <div className="flex items-center gap-1.5">
            <a href={previewUrl} target="_blank" rel="noreferrer" className={lightAction}>
              <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span className="hidden sm:inline">Ouvrir</span>
            </a>
            <a href={doc.downloadUrl} className={lightAction}>
              <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span className="hidden sm:inline">Télécharger</span>
            </a>
            <button type="button" onClick={() => { onClose(); openComposer({ subject: `Document : ${doc.displayTitle}`, attachments: [{ documentId: doc.id, name: doc.displayTitle }] }); }} className={lightAction}>
              <Mail className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span className="hidden sm:inline">Envoyer par mail</span>
            </button>
            <SignDocumentButton documentId={doc.id} title={doc.displayTitle} mimeType={doc.mimeType} variant="icon" />
            <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15">
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Aperçu grand format */}
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 px-4 pb-5">
          <div className="w-full overflow-hidden rounded-xl bg-white shadow-2xl">
            <iframe title={`Aperçu — ${doc.displayTitle}`} src={previewUrl} className="h-full w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
