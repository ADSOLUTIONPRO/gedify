"use client";

import { DocumentRow } from "@/components/documents/document-row";
import type { DocActionHandlers } from "@/components/documents/types";
import type { DocumentVM } from "@/components/documents/types";

type DocumentListProps = {
  docs: DocumentVM[];
  selectedIds: Set<number>;
  activeId: number | null;
  onToggle: (id: number, shift?: boolean) => void;
  onToggleAll: () => void;
  onActivate: (id: number) => void;
  actions: DocActionHandlers;
  aiBusyId: number | null;
  archiveMode?: "archive" | "unarchive";
};

/**
 * Liste de documents en lignes (vue « Liste », écran md+). Inclut un en-tête
 * avec case « tout sélectionner ». Chaque ligne propose les mêmes actions que
 * la carte (vue Grille) via le menu d'actions partagé.
 */
export function DocumentList({
  docs,
  selectedIds,
  activeId,
  onToggle,
  onToggleAll,
  onActivate,
  actions,
  aiBusyId,
  archiveMode,
}: DocumentListProps) {
  const allChecked = docs.length > 0 && docs.every((d) => selectedIds.has(d.id));

  return (
    <div>
      <div
        className="flex items-center gap-3 border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide"
        style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}
      >
        <input
          type="checkbox"
          checked={allChecked}
          onChange={onToggleAll}
          aria-label="Tout sélectionner"
          className="h-4 w-4 rounded border-slate-300 accent-[var(--accent)]"
        />
        <span>{docs.length} document(s)</span>
      </div>
      <div>
        {docs.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            checked={selectedIds.has(doc.id)}
            active={doc.id === activeId}
            onToggle={onToggle}
            onActivate={onActivate}
            actions={actions}
            aiBusy={aiBusyId === doc.id}
            archiveMode={archiveMode}
          />
        ))}
      </div>
    </div>
  );
}
