"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChevronRight, Clock, Folder, FolderPlus, Grid2x2, Home, List, Loader2, Plus, Search, Star, X,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   Sélecteur de dossier/projet « explorateur » (style Finder/Explorer).
   Source de vérité = espace Organiser via /api/projects (arborescence à plat
   avec parentId). Réutilisable (import, workflows, classement manuel…).
   ──────────────────────────────────────────────────────────────────────── */

export type FolderSelection = { id: string; type: "folder" | "project"; name: string; path: string };

type RawFolder = {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  category?: string;
  status?: string;
  linkedDocumentIds?: string[] | number[];
  updatedAt?: string;
};

type FolderNode = {
  id: string; name: string; parentId: string | null;
  color: string; category: string | null; archived: boolean;
  docCount: number; updatedAt: string;
};

const VIEW_KEY = "gedify.folderpicker.view";
const FAV_KEY = "gedify.folderpicker.favorites";

function readFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]") as string[]; } catch { return []; }
}

export function FolderPickerModal({
  currentValue,
  allowCreate = true,
  onSelect,
  onClose,
}: {
  currentValue?: FolderSelection | null;
  allowCreate?: boolean;
  onSelect: (value: FolderSelection) => void;
  onClose: () => void;
}) {
  const currentId = currentValue?.id ?? null;
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(currentId ? "__pending__" : null);
  const [selectedId, setSelectedId] = useState<string | null>(currentId);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">(() => {
    try { const v = localStorage.getItem(VIEW_KEY); return v === "grid" ? "grid" : "list"; } catch { return "list"; }
  });
  const [location, setLocation] = useState<"all" | "recent" | "favorites">("all");
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  const pathOf = useCallback((id: string | null): string => {
    if (!id) return "Organiser";
    const parts: string[] = [];
    const seen = new Set<string>();
    let cur: FolderNode | undefined = byId.get(id);
    while (cur && !seen.has(cur.id)) {
      parts.unshift(cur.name);
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return ["Organiser", ...parts].join(" / ");
  }, [byId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results?: RawFolder[] };
      const nodes: FolderNode[] = (data.results ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId ?? null,
        color: f.color || "#94a3b8",
        category: f.category ?? null,
        archived: f.status === "Archivé",
        docCount: Array.isArray(f.linkedDocumentIds) ? f.linkedDocumentIds.length : 0,
        updatedAt: f.updatedAt ?? "",
      }));
      setFolders(nodes);
      // Ouvre directement le dossier déjà associé (sur son parent).
      setParentId((prev) => {
        if (prev !== "__pending__") return prev;
        const cur = currentId ? nodes.find((n) => n.id === currentId) : null;
        return cur?.parentId ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [currentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setViewPersist = useCallback((v: "list" | "grid") => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Liste affichée selon l'emplacement / la recherche.
  const visible: FolderNode[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return folders
        .filter((f) => !f.archived)
        .filter((f) => f.name.toLowerCase().includes(q) || pathOf(f.id).toLowerCase().includes(q))
        .slice(0, 200);
    }
    if (location === "recent") {
      return [...folders].filter((f) => !f.archived && f.updatedAt).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 30);
    }
    if (location === "favorites") {
      return folders.filter((f) => favorites.includes(f.id));
    }
    return folders.filter((f) => (f.parentId ?? null) === parentId && !f.archived);
  }, [folders, query, location, parentId, favorites, pathOf]);

  const breadcrumb = useMemo(() => {
    const crumbs: FolderNode[] = [];
    const seen = new Set<string>();
    let cur = parentId ? byId.get(parentId) : undefined;
    while (cur && !seen.has(cur.id)) { crumbs.unshift(cur); seen.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    return crumbs;
  }, [parentId, byId]);

  const open = useCallback((f: FolderNode) => {
    setLocation("all");
    setQuery("");
    setParentId(f.id);
    setSelectedId(f.id);
  }, []);

  const confirm = useCallback(() => {
    if (!selectedId) return;
    const node = byId.get(selectedId);
    if (!node || node.archived) return;
    onSelect({ id: node.id, type: "folder", name: node.name, path: pathOf(node.id) });
  }, [selectedId, byId, onSelect, pathOf]);

  async function createFolder() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name, parentId: location === "all" && !query ? parentId : null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = (await res.json()) as RawFolder;
      setCreating(false);
      setNewName("");
      await load();
      setSelectedId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  const selectedPath = selectedId ? pathOf(selectedId) : pathOf(parentId);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Sélectionner un dossier ou un projet">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <div ref={dialogRef} className="relative z-10 flex h-[90vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
          <div>
            <h2 className="text-[15.5px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>Sélectionner un dossier ou un projet</h2>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Choisissez l&apos;emplacement dans lequel classer ce document.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--surface-muted)]" style={{ color: "var(--text-muted)" }}>
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Barre recherche + vue */}
        <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: "var(--border-soft)" }}>
          <div className="flex flex-1 items-center gap-2 rounded-xl border px-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-hint)" }} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un dossier ou un projet…" className="h-9 w-full bg-transparent text-[13px] outline-none" style={{ color: "var(--text-main)" }} />
          </div>
          <div className="flex items-center gap-0.5 rounded-xl border p-0.5" style={{ borderColor: "var(--border)" }}>
            <ViewBtn active={view === "list"} onClick={() => setViewPersist("list")} label="Vue liste"><List className="h-4 w-4" strokeWidth={1.85} /></ViewBtn>
            <ViewBtn active={view === "grid"} onClick={() => setViewPersist("grid")} label="Vue grille"><Grid2x2 className="h-4 w-4" strokeWidth={1.85} /></ViewBtn>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Emplacements */}
          <aside className="hidden w-44 shrink-0 border-r p-2 sm:block" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card-soft)" }}>
            <SideItem icon={Home} label="Tous les dossiers" active={location === "all" && !query} onClick={() => { setLocation("all"); setQuery(""); setParentId(null); }} />
            <SideItem icon={Clock} label="Récents" active={location === "recent"} onClick={() => { setLocation("recent"); setQuery(""); }} />
            <SideItem icon={Star} label="Favoris" active={location === "favorites"} onClick={() => { setLocation("favorites"); setQuery(""); }} />
          </aside>

          {/* Contenu */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Fil d'Ariane */}
            {location === "all" && !query ? (
              <nav className="flex flex-wrap items-center gap-1 border-b px-4 py-2 text-[12px]" style={{ borderColor: "var(--border-soft)" }} aria-label="Fil d'Ariane">
                <button type="button" onClick={() => { setParentId(null); setSelectedId(null); }} className="inline-flex items-center gap-1 font-semibold hover:underline" style={{ color: "var(--text-muted)" }}>
                  <Home className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" /> Organiser
                </button>
                {breadcrumb.map((c) => (
                  <span key={c.id} className="flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--text-hint)" }} aria-hidden="true" />
                    <button type="button" onClick={() => { setParentId(c.id); setSelectedId(c.id); }} className="font-semibold hover:underline" style={{ color: "var(--text-main)" }}>{c.name}</button>
                  </span>
                ))}
              </nav>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-[13px]" style={{ color: "var(--text-muted)" }}>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement de l&apos;arborescence…
                </div>
              ) : error ? (
                <p className="rounded-xl px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--gedify-orange-soft)", color: "var(--text-main)" }}>{error}</p>
              ) : visible.length === 0 ? (
                <div className="py-12 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {query ? "Aucun résultat." : location === "favorites" ? "Aucun favori." : "Dossier vide."}
                </div>
              ) : view === "grid" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {visible.map((f) => (
                    <GridTile key={f.id} f={f} selected={f.id === selectedId} showPath={Boolean(query)} path={pathOf(f.id)} onSelect={() => setSelectedId(f.id)} onOpen={() => open(f)} />
                  ))}
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {visible.map((f) => (
                    <RowItem key={f.id} f={f} selected={f.id === selectedId} fav={favorites.includes(f.id)} showPath={Boolean(query) || location !== "all"} path={pathOf(f.id)} onSelect={() => setSelectedId(f.id)} onOpen={() => open(f)} onToggleFav={() => toggleFavorite(f.id)} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Pied : chemin + création + actions */}
        <div className="border-t" style={{ borderColor: "var(--border-soft)" }}>
          {creating ? (
            <div className="flex items-center gap-2 px-4 pt-3">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void createFolder(); if (e.key === "Escape") setCreating(false); }} placeholder={`Nouveau dossier dans « ${pathOf(parentId)} »`} className="h-9 flex-1 rounded-xl border px-3 text-[13px] outline-none" style={{ borderColor: "var(--accent)", color: "var(--text-main)" }} />
              <button type="button" onClick={() => void createFolder()} disabled={busy || !newName.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" strokeWidth={2} />} Créer
              </button>
              <button type="button" onClick={() => setCreating(false)} className="inline-flex h-9 items-center rounded-xl border px-3 text-[13px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Annuler</button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--text-main)" }}>Chemin :</span> {selectedPath}
            </p>
            <div className="flex items-center gap-2">
              {allowCreate && !creating ? (
                <button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                  <FolderPlus className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> Nouveau dossier
                </button>
              ) : null}
              <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-xl border px-4 text-[13.5px] font-semibold transition hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Annuler</button>
              <button type="button" onClick={confirm} disabled={!selectedId} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
                Sélectionner
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-7 w-7 items-center justify-center rounded-lg transition" style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-muted)" }}>
      {children}
    </button>
  );
}

function SideItem({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-0.5 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-semibold transition" style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-main)" }}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden="true" /> {label}
    </button>
  );
}

function FolderIcon({ color, large }: { color: string; large?: boolean }) {
  return <Folder className={large ? "h-9 w-9" : "h-5 w-5"} strokeWidth={1.6} style={{ color }} aria-hidden="true" />;
}

function RowItem({ f, selected, fav, showPath, path, onSelect, onOpen, onToggleFav }: {
  f: FolderNode; selected: boolean; fav: boolean; showPath: boolean; path: string;
  onSelect: () => void; onOpen: () => void; onToggleFav: () => void;
}) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onDoubleClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
        className="group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition"
        style={selected ? { background: "var(--accent-soft)" } : undefined}
      >
        <FolderIcon color={f.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--text-main)" }}>
            {f.name}
            {f.category ? <span className="ml-1.5 rounded px-1 py-0.5 text-[9.5px] font-bold align-middle" style={{ background: "var(--gedify-purple-soft)", color: "var(--gedify-purple)" }}>{f.category}</span> : null}
          </p>
          <p className="truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
            {showPath ? path : `${f.docCount} doc${f.docCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleFav(); }} aria-label="Favori" className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition group-hover:opacity-100" style={{ color: fav ? "var(--gedify-orange)" : "var(--text-hint)" }}>
          <Star className="h-4 w-4" strokeWidth={1.85} fill={fav ? "currentColor" : "none"} />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} aria-label={`Ouvrir ${f.name}`} className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white" style={{ color: "var(--text-muted)" }}>
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </li>
  );
}

function GridTile({ f, selected, showPath, path, onSelect, onOpen }: {
  f: FolderNode; selected: boolean; showPath: boolean; path: string; onSelect: () => void; onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onOpen}
      className="flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition hover:shadow-sm"
      style={{ borderColor: selected ? "var(--accent)" : "var(--border)", background: selected ? "var(--accent-soft)" : "var(--surface)" } as CSSProperties}
    >
      <FolderIcon color={f.color} large />
      <span className="line-clamp-2 text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{f.name}</span>
      <span className="truncate text-[10.5px]" style={{ color: "var(--text-muted)" }}>{showPath ? path : `${f.docCount} doc${f.docCount > 1 ? "s" : ""}`}</span>
    </button>
  );
}
