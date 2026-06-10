"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle2 } from "lucide-react";
import { GedifyErrorHint } from "@/components/ui/gedify-error-hint";

type ExportCounts = {
  documents: number;
  files: number;
  correspondents: number;
  tags: number;
  document_types: number;
  storage_paths: number;
  custom_fields: number;
  saved_views: number;
  dataFiles: number;
};

export function ExportButton() {
  const [includeFiles, setIncludeFiles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<ExportCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runExport() {
    setLoading(true);
    setError(null);
    setCounts(null);
    try {
      const res = await fetch(`/api/admin/export?files=${includeFiles}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const data = (await res.json()) as { error?: string; details?: string };
          msg = data.error ? `${data.error}${data.details ? ` — ${data.details}` : ""}` : msg;
        } catch {
          /* corps non-JSON */
        }
        throw new Error(msg);
      }

      const header = res.headers.get("X-Export-Counts");
      if (header) {
        try {
          setCounts(JSON.parse(header) as ExportCounts);
        } catch {
          /* en-tête absent/illisible */
        }
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] ?? `gedify-export-${Date.now()}.zip`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Génère une archive <strong>.zip</strong> complète : documents et fichiers originaux,
        taxonomies (tags, correspondants, types, chemins, champs personnalisés, vues),
        analyses OCR/IA, dossiers &amp; projets, finances, actions, courriers, liens mail↔document
        et réglages. Les identifiants de connexion mail (jetons OAuth, mots de passe) sont exclus.
      </p>

      <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-main)" }}>
        <input
          type="checkbox"
          checked={includeFiles}
          onChange={(e) => setIncludeFiles(e.target.checked)}
          className="h-4 w-4 rounded"
        />
        Inclure les fichiers originaux (PDF, images…)
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runExport}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--blue-600)" }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {loading ? "Préparation de l'archive…" : "Exporter toutes les données (.zip)"}
        </button>

        {error ? (
          <span className="flex items-center gap-2 text-[13px] font-semibold text-rose-700">
            <GedifyErrorHint code="generic" message={error} onRetry={() => void runExport()} retryLabel="Relancer l'export" />
            {error}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Selon le nombre de documents, la collecte des fichiers peut prendre un moment.
        </p>
      ) : null}

      {counts ? (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#16A34A" }}>
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> Archive générée
          </p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <li>Documents : <strong>{counts.documents}</strong></li>
            <li>Fichiers : <strong>{counts.files}</strong></li>
            <li>Correspondants : <strong>{counts.correspondents}</strong></li>
            <li>Tags : <strong>{counts.tags}</strong></li>
            <li>Types : <strong>{counts.document_types}</strong></li>
            <li>Chemins : <strong>{counts.storage_paths}</strong></li>
            <li>Champs perso : <strong>{counts.custom_fields}</strong></li>
            <li>Vues : <strong>{counts.saved_views}</strong></li>
            <li>Fichiers de données : <strong>{counts.dataFiles}</strong></li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
