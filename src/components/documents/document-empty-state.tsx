import Link from "next/link";
import { FileSearch, Upload } from "lucide-react";

type DocumentEmptyStateProps = {
  title?: string;
  description?: string;
  /** Affiche le bouton d'import (masqué pour les onglets non encore branchés). */
  showImport?: boolean;
};

/**
 * État vide propre pour la liste de documents (aucun résultat / onglet sans
 * données). Aucune métadonnée technique, message orienté action.
 */
export function DocumentEmptyState({
  title = "Aucun document trouvé",
  description = "Ajustez les filtres ou importez un document.",
  showImport = true,
}: DocumentEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "rgba(11,92,255,0.08)", color: "var(--blue-600)" }}
      >
        <FileSearch className="h-7 w-7" strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-[15px] font-bold" style={{ color: "var(--text-main)" }}>
        {title}
      </p>
      <p className="mt-1 max-w-sm text-[13px]" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
      {showImport ? (
        <Link
          href="/import"
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--blue-600)" }}
        >
          <Upload className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Importer un document
        </Link>
      ) : null}
    </div>
  );
}
