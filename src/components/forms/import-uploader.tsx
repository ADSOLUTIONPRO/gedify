"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, FileText, Loader2, Sparkles, TriangleAlert, Upload, XCircle } from "lucide-react";
import { IMPORT_ACCEPT } from "@/lib/documents/import-formats";

type ImportResult = {
  ok: boolean;
  taskId: string | null;
  documentId: number | null;
  fileName: string;
  aiEnabled: boolean;
  status: "imported" | "failed";
  message: string;
  error?: string;
};

type UploadItem = {
  name: string;
  /** uploading = envoi réel du fichier ; success = importé (traitement de fond) ; error = import refusé. */
  status: "pending" | "uploading" | "success" | "error";
  result?: ImportResult;
  error?: string;
  documentId?: number | null;
  /** Étape de traitement de fond (renvoyée par /api/documents/import-status). */
  processingLabel?: string;
  processingDone?: boolean;
  processingError?: string | null;
};

type StatusRow = {
  id: number;
  found: boolean;
  label?: string;
  done?: boolean;
  error?: string | null;
  currentStep?: string;
};

const POLL_MS = 3000;

export function ImportUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);

  const updateItem = useCallback((name: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, ...patch } : i)));
  }, []);

  async function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    if (selected.length === 0) return;

    setItems(selected.map((f) => ({ name: f.name, status: "pending" })));

    // Envoi séquentiel des octets : chaque POST répond DÈS que le fichier est
    // écrit + le document créé (traitement en arrière-plan) → plus de blocage.
    for (const file of selected) {
      updateItem(file.name, { status: "uploading" });
      const fd = new FormData();
      fd.append("document", file, file.name);
      try {
        const res = await fetch("/api/documents/import", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as Partial<ImportResult> & { error?: string };
        if (!res.ok || data.ok === false || data.status === "failed") {
          throw new Error(data.error ?? data.message ?? "Import refusé.");
        }
        updateItem(file.name, {
          status: "success",
          result: data as ImportResult,
          documentId: data.documentId ?? null,
          processingLabel: "Importé — traitement en arrière-plan",
          processingDone: false,
        });
      } catch (err) {
        updateItem(file.name, {
          status: "error",
          error: err instanceof Error ? err.message : "Erreur inconnue.",
        });
      }
    }
  }

  /* ── Polling du traitement de fond (OCR/index/IA) document par document ──── */
  useEffect(() => {
    const pending = items.filter(
      (i) => i.status === "success" && typeof i.documentId === "number" && !i.processingDone,
    );
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
        /* réseau best-effort — on retentera au prochain tick */
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [items]);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void uploadFiles(e.dataTransfer.files);
  }

  const anySuccess = items.some((i) => i.status === "success");
  const allUploaded = items.length > 0 && items.every((i) => i.status === "success" || i.status === "error");
  const isUploading = items.some((i) => i.status === "uploading" || i.status === "pending");

  return (
    <div
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
    >
      {/* Zone drop */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        className={`flex min-h-60 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <span
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(11,92,255,0.08)", color: "#0B5CFF" }}
        >
          <Upload className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <p className="text-[16px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
          Déposez vos fichiers ici
        </p>
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          PDF, images, DOCX — importés immédiatement. L&apos;OCR, l&apos;indexation et
          l&apos;analyse IA se poursuivent en arrière-plan.
        </p>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl px-5 text-[13.5px] font-bold text-white transition disabled:opacity-60"
          style={{ background: "#0B5CFF" }}
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {isUploading ? "Envoi en cours…" : "Sélectionner des fichiers"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={IMPORT_ACCEPT}
          className="hidden"
          onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); }}
        />
      </div>

      {/* Liste des fichiers */}
      {items.length > 0 ? (
        <div className="mt-4 space-y-2">
          {items.map((item) => {
            const uploading = item.status === "uploading" || item.status === "pending";
            const failedProcessing = Boolean(item.processingError);
            return (
              <div key={item.name} className="rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2.5">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" aria-hidden="true" />
                  ) : item.status === "success" && !failedProcessing ? (
                    item.processingDone ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#16A34A" }} aria-hidden="true" />
                    ) : (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "#16A34A" }} aria-hidden="true" />
                    )
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>
                      {item.name}
                    </p>
                    {uploading ? (
                      <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Envoi en cours…</p>
                    ) : item.status === "error" ? (
                      <p className="text-[11.5px]" style={{ color: "var(--danger)" }}>{item.error}</p>
                    ) : failedProcessing ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[11.5px]" style={{ color: "var(--danger)" }}>
                          {item.processingError}
                        </span>
                        {typeof item.documentId === "number" ? (
                          <Link
                            href={`/documents/${item.documentId}`}
                            className="text-[11.5px] font-semibold underline"
                            style={{ color: "#0B5CFF" }}
                          >
                            Ouvrir le document
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="flex items-center gap-1 text-[11.5px]" style={{ color: item.processingDone ? "#16A34A" : "var(--text-muted)" }}>
                          {item.processingDone ? (
                            <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
                          ) : (
                            <Clock className="h-3 w-3" strokeWidth={1.75} />
                          )}
                          {item.processingLabel ?? "Importé — traitement en arrière-plan"}
                        </span>
                        {item.result?.aiEnabled && !item.processingDone ? (
                          <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "#7C3AED" }}>
                            <Sparkles className="h-3 w-3" strokeWidth={1.75} /> IA disponible
                          </span>
                        ) : null}
                        {typeof item.documentId === "number" ? (
                          <Link
                            href={`/documents/${item.documentId}`}
                            className="text-[11.5px] font-semibold underline"
                            style={{ color: "#0B5CFF" }}
                          >
                            Ouvrir
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Actions post-import (dès l'upload terminé : pas besoin d'attendre le traitement) */}
      {allUploaded && anySuccess ? (
        <div
          className="mt-4 rounded-xl border p-4"
          style={{ borderColor: "rgba(11,92,255,0.15)", background: "rgba(11,92,255,0.03)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0" style={{ color: "#F59E0B" }} strokeWidth={1.75} aria-hidden="true" />
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
              Fichiers importés. Le traitement (OCR, indexation, IA) continue en
              arrière-plan — vous pouvez fermer cette fenêtre.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <Link
              href="/documents"
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition hover:bg-white"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <FileText className="h-4 w-4 shrink-0" style={{ color: "#0B5CFF" }} strokeWidth={1.75} aria-hidden="true" />
              <span className="flex-1">Voir les documents</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link
              href="/ia"
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition hover:bg-white"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <Sparkles className="h-4 w-4 shrink-0" style={{ color: "#7C3AED" }} strokeWidth={1.75} aria-hidden="true" />
              <span className="flex-1">Lancer l&apos;analyse IA</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link
              href="/a-traiter"
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition hover:bg-white"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <Clock className="h-4 w-4 shrink-0" style={{ color: "#F59E0B" }} strokeWidth={1.75} aria-hidden="true" />
              <span className="flex-1">Documents à traiter</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => { setItems([]); inputRef.current?.click(); }}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition hover:bg-white"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <Upload className="h-4 w-4 shrink-0" style={{ color: "#0B5CFF" }} strokeWidth={1.75} aria-hidden="true" />
              <span className="flex-1">Importer un autre fichier</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
