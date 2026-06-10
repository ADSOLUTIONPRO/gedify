"use client";

import { useState } from "react";
import { Upload, Loader2, TriangleAlert, CheckCircle2, FileArchive } from "lucide-react";

type ImportSummary = {
  ok: true;
  mode: "replace" | "merge";
  imported: {
    documents: number;
    files: number;
    thumbnails: number;
    correspondents: number;
    tags: number;
    document_types: number;
    storage_paths: number;
    custom_fields: number;
    saved_views: number;
    dataFiles: number;
  };
  skipped: { documentsDuplicate: number; documentsMissingFile: number };
  errors: string[];
};

const REPLACE_CONFIRM = "IMPORT_REPLACE";

export function ImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const replaceReady = mode === "merge" || confirmText.trim() === REPLACE_CONFIRM;
  const canImport = !!file && replaceReady && !loading;

  async function runImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      // Upload brut (pas de multipart) : le zip part directement dans le corps,
      // les options en query string. Évite le parseur multipart fragile sur gros fichiers.
      const qs = new URLSearchParams({ mode });
      if (mode === "replace") qs.set("confirm", REPLACE_CONFIRM);

      const res = await fetch(`/api/admin/import?${qs.toString()}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/zip" },
        body: file,
      });
      const data = (await res.json()) as ImportSummary | { error?: string; details?: string };
      if (!res.ok || !("ok" in data)) {
        const msg =
          "error" in data && data.error
            ? `${data.error}${data.details ? ` — ${data.details}` : ""}`
            : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setSummary(data as ImportSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Importe une archive <strong>.zip</strong> Gedify exportée depuis l&apos;ancienne version
        ou depuis nopp. Les identifiants (documents, taxonomies) sont <strong>préservés</strong> :
        tous les liens internes (analyses, dossiers, finances, courriers) restent valides.
      </p>

      {/* Sélection du fichier */}
      <label
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 transition hover:bg-slate-50"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(11,92,255,0.08)" }}>
          <FileArchive className="h-5 w-5" style={{ color: "var(--blue-600)" }} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold" style={{ color: "var(--text-main)" }}>
            {file ? file.name : "Choisir un fichier .zip"}
          </span>
          <span className="block text-[12px]" style={{ color: "var(--text-muted)" }}>
            {file ? `${(file.size / 1_048_576).toFixed(1)} Mo` : "Archive gedify-export-*.zip"}
          </span>
        </span>
        <input
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setSummary(null);
            setError(null);
          }}
        />
      </label>

      {/* Mode */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>
          Mode d&apos;import
        </span>
        <div className="flex flex-wrap gap-2">
          <ModeChip active={mode === "replace"} onClick={() => setMode("replace")} label="Remplacer tout" hint="Table rase puis import (migration)" />
          <ModeChip active={mode === "merge"} onClick={() => setMode("merge")} label="Fusionner" hint="Ajoute / met à jour par identifiant" />
        </div>
      </div>

      {/* Confirmation pour remplacement */}
      {mode === "replace" ? (
        <div className="rounded-xl border p-3" style={{ borderColor: "#FCA5A5", background: "rgba(239,68,68,0.05)" }}>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-rose-700">
            <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Le mode « Remplacer » efface les documents, taxonomies et données internes existants avant l&apos;import.
          </p>
          <p className="mb-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
            Tapez <code className="rounded bg-rose-100 px-1 font-mono text-rose-700">{REPLACE_CONFIRM}</code> pour confirmer :
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={REPLACE_CONFIRM}
            className="w-full rounded-lg border px-3 py-1.5 text-sm font-mono"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runImport}
          disabled={!canImport}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: mode === "replace" ? "#DC2626" : "var(--blue-600)" }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {loading ? "Import en cours…" : "Importer l'archive"}
        </button>

        {error ? (
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
            <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {error}
          </p>
        ) : null}
      </div>

      {summary ? (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#16A34A" }}>
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> Import terminé ({summary.mode === "replace" ? "remplacement" : "fusion"})
          </p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <li>Documents : <strong>{summary.imported.documents}</strong></li>
            <li>Fichiers : <strong>{summary.imported.files}</strong></li>
            <li>Miniatures : <strong>{summary.imported.thumbnails}</strong></li>
            <li>Correspondants : <strong>{summary.imported.correspondents}</strong></li>
            <li>Tags : <strong>{summary.imported.tags}</strong></li>
            <li>Types : <strong>{summary.imported.document_types}</strong></li>
            <li>Chemins : <strong>{summary.imported.storage_paths}</strong></li>
            <li>Champs perso : <strong>{summary.imported.custom_fields}</strong></li>
            <li>Vues : <strong>{summary.imported.saved_views}</strong></li>
            <li>Fichiers de données : <strong>{summary.imported.dataFiles}</strong></li>
          </ul>
          {(summary.skipped.documentsDuplicate > 0 || summary.skipped.documentsMissingFile > 0) ? (
            <p className="mt-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Ignorés — doublons : <strong>{summary.skipped.documentsDuplicate}</strong>, sans fichier :{" "}
              <strong>{summary.skipped.documentsMissingFile}</strong>
            </p>
          ) : null}
          {summary.errors.length > 0 ? (
            <details className="mt-2 text-[12px] text-rose-700">
              <summary className="cursor-pointer font-semibold">{summary.errors.length} avertissement(s)</summary>
              <ul className="mt-1 list-disc pl-4">
                {summary.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Restauration des documents, fichiers et données — cela peut prendre un moment.
        </p>
      ) : null}
    </div>
  );
}

function ModeChip({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border px-3 py-2 text-left transition"
      style={{
        borderColor: active ? "var(--blue-600)" : "var(--border)",
        background: active ? "rgba(11,92,255,0.06)" : "white",
      }}
    >
      <span className="block text-sm font-semibold" style={{ color: "var(--text-main)" }}>
        {label}
      </span>
      <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
        {hint}
      </span>
    </button>
  );
}
