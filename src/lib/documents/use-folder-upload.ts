"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ────────────────────────────────────────────────────────────────────────
   Moteur d'upload « dans un dossier Organiser ». Réutilise le pipeline global
   (POST /api/documents/import, un fichier par requête → un échec n'impacte pas
   les autres) en ajoutant le champ `folderId` pour le classement serveur, puis
   suit le traitement de fond (OCR/index/IA) via /api/documents/import-status.
   Partagé par la modale d'import et l'overlay de glisser-déposer.
   ──────────────────────────────────────────────────────────────────────── */

export const FOLDER_IMPORT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.docx,.xlsx,.txt";
const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "tiff", "tif", "docx", "xlsx", "txt"]);
const MAX_BYTES = 100 * 1024 * 1024; // 100 Mo
const POLL_MS = 3000;

export type FolderUploadStatus = "pending" | "invalid" | "uploading" | "success" | "error";

export type FolderUploadItem = {
  /** Clé stable (nom + taille + index) pour suivre l'élément dans la liste. */
  key: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: FolderUploadStatus;
  /** Raison de validation (format/taille/vide) quand status = "invalid". */
  invalidReason?: string;
  documentId?: number | null;
  folderLinked?: boolean | null;
  folderError?: string | null;
  error?: string;
  processingLabel?: string;
  processingDone?: boolean;
  processingError?: string | null;
};

type ImportResponse = {
  ok?: boolean;
  documentId?: number | null;
  folderLinked?: boolean | null;
  folderName?: string | null;
  folderError?: string;
  status?: "imported" | "failed";
  message?: string;
  error?: string;
};

type StatusRow = { id: number; found: boolean; label?: string; done?: boolean; error?: string | null; currentStep?: string };

function validate(file: File): { ok: true } | { ok: false; reason: string } {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (file.size === 0) return { ok: false, reason: "Fichier vide" };
  if (!ALLOWED_EXT.has(ext)) return { ok: false, reason: "Format non pris en charge" };
  if (file.size > MAX_BYTES) return { ok: false, reason: "Fichier trop volumineux (max 100 Mo)" };
  return { ok: true };
}

export function useFolderUpload({ folderId, onImported }: { folderId: string; onImported?: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<FolderUploadItem[]>([]);
  const seq = useRef(0);

  const patch = useCallback((key: string, p: Partial<FolderUploadItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));
  }, []);

  /** Ajoute des fichiers à la liste (validés) SANS lancer l'envoi. */
  const stageFiles = useCallback((files: FileList | File[]) => {
    const added = Array.from(files).map<FolderUploadItem>((file) => {
      const v = validate(file);
      seq.current += 1;
      return {
        key: `${file.name}-${file.size}-${seq.current}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || file.name.split(".").pop()?.toUpperCase() || "—",
        status: v.ok ? "pending" : "invalid",
        invalidReason: v.ok ? undefined : v.reason,
      };
    });
    setItems((prev) => [...prev, ...added]);
    return added;
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const reset = useCallback(() => setItems([]), []);

  /** Envoie tous les éléments encore en attente (un POST par fichier). */
  const startUpload = useCallback(async (target?: FolderUploadItem[]) => {
    const queue = (target ?? items).filter((i) => i.status === "pending");
    if (queue.length === 0) return;
    let anyLinked = false;

    for (const it of queue) {
      patch(it.key, { status: "uploading" });
      const fd = new FormData();
      fd.append("document", it.file, it.name);
      fd.append("folderId", folderId);
      fd.append("source", "organizer");
      try {
        const res = await fetch("/api/documents/import", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as ImportResponse;
        if (!res.ok || data.ok === false || data.status === "failed") {
          throw new Error(data.error ?? data.message ?? "Import refusé.");
        }
        if (data.folderLinked) anyLinked = true;
        patch(it.key, {
          status: "success",
          documentId: data.documentId ?? null,
          folderLinked: data.folderLinked ?? null,
          folderError: data.folderError ?? null,
          processingLabel: data.message ?? "Importé — traitement en arrière-plan",
          processingDone: false,
        });
      } catch (err) {
        patch(it.key, { status: "error", error: err instanceof Error ? err.message : "Erreur inconnue." });
      }
    }

    // Le document est lié côté serveur → rafraîchir la liste du dossier (RSC,
    // sans rechargement complet ni perte de scroll).
    if (anyLinked) {
      router.refresh();
      onImported?.();
    }
  }, [items, folderId, patch, router, onImported]);

  /** Stage + envoi immédiat (glisser-déposer). */
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const added = stageFiles(files);
    await startUpload(added);
  }, [stageFiles, startUpload]);

  /* ── Suivi du traitement de fond (OCR/index/IA), document par document ──── */
  useEffect(() => {
    const pending = items.filter((i) => i.status === "success" && typeof i.documentId === "number" && !i.processingDone);
    if (pending.length === 0) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const ids = pending.map((i) => i.documentId).join(",");
      try {
        const res = await fetch(`/api/documents/import-status?ids=${ids}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { documents?: StatusRow[] };
        if (cancelled || !data.documents) return;
        setItems((prev) =>
          prev.map((it) => {
            if (it.status !== "success" || typeof it.documentId !== "number") return it;
            const row = data.documents!.find((d) => d.id === it.documentId);
            if (!row || !row.found) return it;
            return {
              ...it,
              processingLabel: row.label ?? it.processingLabel,
              processingDone: Boolean(row.done),
              processingError: row.currentStep === "failed" ? (row.error ?? "Traitement échoué.") : null,
            };
          }),
        );
      } catch {
        /* réseau best-effort — nouveau tick au prochain intervalle */
      }
    }, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [items]);

  const uploading = items.some((i) => i.status === "uploading");
  const pendingCount = items.filter((i) => i.status === "pending").length;
  const hasResults = items.some((i) => i.status === "success" || i.status === "error");

  return { items, stageFiles, startUpload, uploadFiles, removeItem, reset, uploading, pendingCount, hasResults };
}
