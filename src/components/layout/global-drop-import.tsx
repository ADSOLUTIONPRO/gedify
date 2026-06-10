"use client";

import { useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { FolderImportModal } from "@/components/projects/folder-import-modal";

/* ────────────────────────────────────────────────────────────────────────
   Glisser-déposer GLOBAL : déposer un ou plusieurs fichiers N'IMPORTE OÙ dans
   l'application ouvre l'import et lance la relève DIRECTEMENT (avec la barre de
   progression de la modale). Affiche un voile « Déposez pour importer » pendant
   le survol. Ne s'active que pour de VRAIS fichiers externes (dataTransfer
   « Files »), jamais pour les glisser internes (réorganisation, etc.).

   Coexistence avec les zones de dépôt spécifiques (ex. dossiers Organiser) : si
   une zone a déjà traité le drop (`event.defaultPrevented`), on s'efface.
   ──────────────────────────────────────────────────────────────────────── */

function dragHasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

export function GlobalDropImport() {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[] | null>(null);
  const depth = useRef(0);

  useEffect(() => {
    function onEnter(e: DragEvent) {
      if (!dragHasFiles(e)) return;
      depth.current += 1;
      setDragging(true);
    }
    function onOver(e: DragEvent) {
      if (!dragHasFiles(e)) return;
      e.preventDefault(); // autorise le dépôt + empêche le navigateur d'ouvrir le fichier
    }
    function onLeave(e: DragEvent) {
      if (!dragHasFiles(e)) return;
      depth.current -= 1;
      if (depth.current <= 0) { depth.current = 0; setDragging(false); }
    }
    function onDrop(e: DragEvent) {
      if (!dragHasFiles(e)) return;
      // Une zone spécifique (dossier Organiser, modale d'import…) a déjà pris le
      // dépôt → on ne double-importe pas.
      const handledElsewhere = e.defaultPrevented;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (handledElsewhere) return;
      const dropped = Array.from(e.dataTransfer?.files ?? []);
      if (dropped.length > 0) setFiles(dropped);
    }
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <>
      {/* Voile pendant le survol (caché si la modale d'import est déjà ouverte) */}
      {dragging && !files ? (
        <div className="pointer-events-none fixed inset-0 z-[110] flex items-center justify-center p-6" aria-hidden="true">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
          <div
            className="relative flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-12 py-10 text-center shadow-2xl"
            style={{ background: "var(--surface)", borderColor: "var(--accent)" }}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <UploadCloud className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <p className="text-[17px] font-extrabold" style={{ color: "var(--text-main)" }}>Déposez pour importer</p>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>L&apos;import démarre automatiquement · tous formats (PDF, Word, Excel, images…)</p>
          </div>
        </div>
      ) : null}

      {/* Import direct (avec progression) des fichiers déposés. */}
      {files ? <FolderImportModal autoImportFiles={files} onClose={() => setFiles(null)} /> : null}
    </>
  );
}
