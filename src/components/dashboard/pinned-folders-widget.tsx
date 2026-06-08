"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Folder, FolderKanban, Loader2, Pin, X } from "lucide-react";

type PinnedFolder = {
  id: string;
  entityType: "folder" | "project";
  entityId: string;
  exists: boolean;
  name: string;
  path: string | null;
  documentCount: number;
  archived: boolean;
  color: string | null;
};

/** Widget tableau de bord : dossiers/projets épinglés (par utilisateur). */
export function PinnedFoldersWidget() {
  const [items, setItems] = useState<PinnedFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pinned-items", { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { items?: PinnedFolder[] };
        setItems(data.items ?? []);
      }
    } catch {
      /* hors-ligne */
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function unpin(entityId: string) {
    setItems((prev) => prev.filter((p) => p.entityId !== entityId));
    await fetch(`/api/pinned-items/${entityId}`, { method: "DELETE", credentials: "include" }).catch(() => {});
  }

  if (loading) {
    return <div className="flex items-center gap-2 py-4 text-[12.5px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl px-3 py-5 text-center" style={{ background: "var(--bg-card-soft)" }}>
        <Pin className="mx-auto h-5 w-5" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
        <p className="mt-1.5 text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun dossier épinglé</p>
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>Épinglez un dossier depuis Organiser pour le retrouver ici.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((it) => (
        <li key={it.id} className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-[var(--bg-card-soft)]">
          <Link href={`/dossiers/${it.entityId}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: it.color ?? "var(--accent-soft)" }}>
              {it.entityType === "project" ? <FolderKanban className="h-4 w-4 text-white" strokeWidth={1.85} /> : <Folder className="h-4 w-4" style={{ color: it.color ? "#fff" : "var(--accent)" }} strokeWidth={1.85} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{it.name}</span>
                {it.archived ? <span className="rounded px-1 text-[9.5px] font-bold" style={{ background: "var(--surface-muted)", color: "var(--text-muted)" }}>Archivé</span> : null}
                {!it.exists ? <span className="rounded px-1 text-[9.5px] font-bold" style={{ background: "var(--gedify-orange-soft)", color: "var(--gedify-orange)" }}>Supprimé</span> : null}
              </span>
              <span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                {it.path && it.path !== it.name ? `${it.path} · ` : ""}{it.documentCount} doc{it.documentCount > 1 ? "s" : ""}
              </span>
            </span>
          </Link>
          <button type="button" onClick={() => void unpin(it.entityId)} aria-label={`Retirer ${it.name}`} title="Retirer du tableau de bord" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-0 transition hover:bg-white group-hover:opacity-100" style={{ color: "var(--text-muted)" }}>
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </li>
      ))}
    </ul>
  );
}
