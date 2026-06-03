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
export function SidebarFolderTree({ onNavigate }: { onNavigate?: () => void }) {
  const folderId = useSearchParams().get("folder");
  const [folders, setFolders] = useState<RawFolder[] | null>(null);

  const refetch = useCallback(() => {
    fetch("/api/projects", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d: { results?: RawFolder[] }) => setFolders(d.results ?? []))
      .catch(() => setFolders([]));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

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
      onNavigate={onNavigate}
      onChanged={refetch}
    />
  );
}
