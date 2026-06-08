"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FolderExplorer, buildFolderNodes, type RawFolder } from "@/components/organiser/folder-tree";

/**
 * Arbre des dossiers intégré à la barre latérale de l'espace Organiser.
 * Récupère les dossiers, construit l'arbre, et reflète le dossier courant
 * (`?folder=`). Se rafraîchit après création/déplacement/suppression.
 */
type PinnedItem = { entityType: string; entityId: string };

export function SidebarFolderTree({ onNavigate }: { onNavigate?: () => void }) {
  const folderId = useSearchParams().get("folder");
  const [folders, setFolders] = useState<RawFolder[] | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const refetch = useCallback(() => {
    fetch("/api/projects", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d: { results?: RawFolder[] }) => setFolders(d.results ?? []))
      .catch(() => setFolders([]));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // Épingles de l'utilisateur (pour afficher l'état dans l'arbre).
  useEffect(() => {
    fetch("/api/pinned-items", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: PinnedItem[] }) => setPinnedIds(new Set((d.items ?? []).filter((p) => p.entityType === "folder").map((p) => p.entityId))))
      .catch(() => {});
  }, []);

  if (folders === null) {
    return (
      <p className="flex items-center gap-1.5 px-2 py-3 text-[12px]" style={{ color: "var(--text-hint)" }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des dossiers…
      </p>
    );
  }

  return (
    <FolderExplorer
      tree={buildFolderNodes(folders)}
      currentId={folderId}
      variant="sidebar"
      pinnedIds={pinnedIds}
      onNavigate={onNavigate}
      onChanged={refetch}
    />
  );
}
