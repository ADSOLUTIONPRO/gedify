"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { FolderImportModal } from "@/components/projects/folder-import-modal";

/** Bouton « Importer » de la topbar : ouvre une POPUP d'import (glisser-déposer
 *  + parcourir, multi-fichiers, progression) au lieu de naviguer vers /import. */
export function TopbarImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 cursor-pointer items-center gap-2 rounded-[20px] px-4 text-[13px] font-bold text-white transition hover:opacity-90 sm:inline-flex"
        style={{ background: "var(--accent)" }}
      >
        <Upload className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        <span className="hidden sm:inline">Importer</span>
      </button>
      {open ? <FolderImportModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
