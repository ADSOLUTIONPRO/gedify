"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FolderInput, Loader2, X, XCircle } from "lucide-react";
import type { FolderUploadItem } from "@/lib/documents/use-folder-upload";

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Liste d'éléments d'import (type, taille, état de validation, actions). */
export function ImportFileList({
  items,
  onRemove,
  compact = false,
}: {
  items: FolderUploadItem[];
  onRemove?: (key: string) => void;
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={compact ? "space-y-1.5" : "space-y-2"}>
      {items.map((item) => {
        const removable = onRemove && (item.status === "pending" || item.status === "invalid");
        const failedProcessing = Boolean(item.processingError);
        return (
          <li key={item.key} className="rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex items-center gap-2.5">
              <Icon item={item} failedProcessing={failedProcessing} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{item.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                  <span className="uppercase">{(item.type || "").replace("application/", "").replace("image/", "") || "—"}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatSize(item.size)}</span>
                  <span aria-hidden="true">·</span>
                  <StateLabel item={item} failedProcessing={failedProcessing} />
                  {item.folderLinked ? (
                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--gedify-green)" }}>
                      <FolderInput className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> classé
                    </span>
                  ) : null}
                  {typeof item.documentId === "number" ? (
                    <Link href={`/documents/${item.documentId}`} className="font-semibold underline" style={{ color: "var(--accent)" }}>Ouvrir</Link>
                  ) : null}
                </div>
              </div>
              {removable ? (
                <button
                  type="button"
                  onClick={() => onRemove!(item.key)}
                  aria-label={`Retirer ${item.name}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-[var(--surface-muted)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Icon({ item, failedProcessing }: { item: FolderUploadItem; failedProcessing: boolean }) {
  if (item.status === "uploading") return <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--accent)" }} aria-hidden="true" />;
  if (item.status === "invalid") return <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--gedify-orange)" }} aria-hidden="true" />;
  if (item.status === "error") return <XCircle className="h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden="true" />;
  if (item.status === "success") {
    if (failedProcessing) return <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--gedify-orange)" }} aria-hidden="true" />;
    return item.processingDone
      ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--gedify-green)" }} aria-hidden="true" />
      : <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--gedify-green)" }} aria-hidden="true" />;
  }
  return <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--text-hint)" }} aria-hidden="true" />;
}

function StateLabel({ item, failedProcessing }: { item: FolderUploadItem; failedProcessing: boolean }) {
  if (item.status === "pending") return <span style={{ color: "var(--text-hint)" }}>En attente</span>;
  if (item.status === "invalid") return <span style={{ color: "var(--gedify-orange)" }}>{item.invalidReason}</span>;
  if (item.status === "uploading") return <span style={{ color: "var(--accent)" }}>Envoi en cours…</span>;
  if (item.status === "error") return <span style={{ color: "var(--danger)" }}>{item.error}</span>;
  if (failedProcessing) return <span style={{ color: "var(--gedify-orange)" }}>{item.processingError}</span>;
  if (item.folderError) return <span style={{ color: "var(--gedify-orange)" }}>{item.folderError}</span>;
  return <span style={{ color: item.processingDone ? "var(--gedify-green)" : "var(--text-muted)" }}>{item.processingDone ? "Traitement terminé" : (item.processingLabel ?? "Traitement en arrière-plan")}</span>;
}
