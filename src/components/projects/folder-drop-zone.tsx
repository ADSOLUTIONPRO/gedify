"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { FolderInput, UploadCloud, X } from "lucide-react";
import { ImportFileList } from "@/components/documents/import-file-list";
import { useFolderUpload } from "@/lib/documents/use-folder-upload";

/**
 * Couvre la zone de contenu du dossier (placée dans un parent `relative`) :
 * détecte le glisser de fichiers et affiche un overlay « Déposez dans « Nom » ».
 * Au relâchement DANS la zone, importe immédiatement et classe dans le dossier
 * (champ folderId côté serveur). Un dépôt hors zone ne déclenche aucun import.
 * Un panneau flottant suit l'avancement sans masquer la sidebar / la topbar.
 */
export function FolderDropZone({ folderId, folderName }: { folderId: string; folderName: string }) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const { items, uploadFiles, reset } = useFolderUpload({ folderId });

  useEffect(() => {
    function hasFiles(e: DragEvent | globalThis.DragEvent) {
      return Array.from((e as globalThis.DragEvent).dataTransfer?.types ?? []).includes("Files");
    }
    function onEnter(e: globalThis.DragEvent) {
      if (!hasFiles(e)) return;
      depth.current += 1;
      setActive(true);
    }
    function onOver(e: globalThis.DragEvent) {
      if (hasFiles(e)) e.preventDefault(); // autorise le drop + bloque l'ouverture navigateur
    }
    function onLeave() {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    }
    function onDropWin(e: globalThis.DragEvent) {
      // Empêche le navigateur d'ouvrir un fichier déposé HORS de la zone.
      e.preventDefault();
      depth.current = 0;
      setActive(false);
    }
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDropWin);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDropWin);
    };
  }, []);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    depth.current = 0;
    setActive(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  return (
    <>
      {/* Overlay scopé à la zone de contenu (parent relative). */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`absolute inset-0 z-40 flex items-center justify-center rounded-3xl transition ${active ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ background: "color-mix(in srgb, var(--accent-soft) 92%, transparent)", border: "2px dashed var(--accent)", backdropFilter: "blur(2px)" }}
        aria-hidden={!active}
      >
        <div className="pointer-events-none flex flex-col items-center text-center">
          <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl text-white" style={{ background: "var(--accent)" }}>
            <UploadCloud className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="text-[17px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
            Déposez vos documents dans «&nbsp;{folderName}&nbsp;»
          </p>
          <p className="mt-1 text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
            PDF, images, DOCX et autres formats autorisés
          </p>
        </div>
      </div>

      {/* Panneau d'avancement flottant (ne masque ni sidebar ni topbar). */}
      {items.length > 0 ? (
        <div className="fixed bottom-4 right-4 z-[70] w-[min(92vw,22rem)] rounded-2xl border p-3 shadow-xl" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>
              <FolderInput className="h-4 w-4" strokeWidth={1.85} style={{ color: "var(--accent)" }} aria-hidden="true" />
              Import dans «&nbsp;{folderName}&nbsp;»
            </span>
            <button type="button" onClick={reset} aria-label="Fermer le suivi" className="flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-[var(--surface-muted)]" style={{ color: "var(--text-muted)" }}>
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto pr-0.5">
            <ImportFileList items={items} compact />
          </div>
        </div>
      ) : null}
    </>
  );
}
