"use client";

import { useState } from "react";
import { FolderInput } from "lucide-react";
import { FolderImportModal } from "@/components/projects/folder-import-modal";

/** Bouton d'en-tête « Importer dans ce dossier » → ouvre la modale ciblée. */
export function FolderImportButton({ folderId, folderName }: { folderId: string; folderName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        style={{ background: "var(--accent)" }}
      >
        <FolderInput className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
        Importer dans ce dossier
      </button>
      {open ? <FolderImportModal folderId={folderId} folderName={folderName} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
