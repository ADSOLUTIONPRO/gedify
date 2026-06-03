"use client";

import { useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, FileText, Loader2, Sparkles, TriangleAlert, Upload, XCircle } from "lucide-react";

type ImportResult = {
  ok: true;
  taskId: string | null;
  fileName: string;
  aiEnabled: boolean;
  message: string;
};

type UploadItem = {
  name: string;
  status: "pending" | "uploading" | "success" | "error";
  result?: ImportResult;
  error?: string;
};

export function ImportUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);

  function updateItem(name: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, ...patch } : i)));
  }

  async function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    if (selected.length === 0) return;

    setItems(selected.map((f) => ({ name: f.name, status: "pending" })));

    for (const file of selected) {
      updateItem(file.name, { status: "uploading" });

      const fd = new FormData();
      fd.append("document", file, file.name);

      try {
        const res = await fetch("/api/documents/import", { method: "POST", body: fd });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Import échoué.");
        }

        const data = (await res.json()) as ImportResult;
        updateItem(file.name, { status: "success", result: data });
      } catch (err) {
        updateItem(file.name, {
          status: "error",
          error: err instanceof Error ? err.message : "Erreur inconnue.",
        });
      }
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void uploadFiles(e.dataTransfer.files);
  }

  const allDone = items.length > 0 && items.every((i) => i.status === "success" || i.status === "error");
  const anySuccess = items.some((i) => i.status === "success");
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
          PDF, images, DOCX — transmis à Gedify via le serveur.
          OCR et indexation s&apos;effectuent côté Gedify.
        </p>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl px-5 text-[13.5px] font-bold text-white transition disabled:opacity-60"
          style={{ background: "#0B5CFF" }}
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {isUploading ? "Import en cours…" : "Sélectionner des fichiers"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.docx,.xlsx,.txt"
          className="hidden"
          onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); }}
        />
      </div>

      {/* Liste des fichiers */}
      {items.length > 0 ? (
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div
              key={item.name}
              className="rounded-xl border px-3 py-2.5"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2.5">
                {item.status === "uploading" || item.status === "pending" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" aria-hidden="true" />
                ) : item.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#16A34A" }} aria-hidden="true" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>
                    {item.name}
                  </p>
                  {item.status === "uploading" || item.status === "pending" ? (
                    <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Envoi en cours…</p>
                  ) : item.status === "success" ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "#16A34A" }}>
                        <Clock className="h-3 w-3" strokeWidth={1.75} /> OCR et indexation en cours côté Gedify
                      </span>
                      {item.result?.aiEnabled ? (
                        <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "#7C3AED" }}>
                          <Sparkles className="h-3 w-3" strokeWidth={1.75} /> Analyse IA disponible
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[11.5px]" style={{ color: "var(--danger)" }}>{item.error}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Actions post-import */}
      {allDone && anySuccess ? (
        <div
          className="mt-4 rounded-xl border p-4"
          style={{ borderColor: "rgba(11,92,255,0.15)", background: "rgba(11,92,255,0.03)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0" style={{ color: "#F59E0B" }} strokeWidth={1.75} aria-hidden="true" />
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
              Gedify traite le document — quelques secondes à quelques minutes selon l&apos;OCR.
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
