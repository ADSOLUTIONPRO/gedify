"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, ChevronRight, FolderPlus, FolderTree as FolderTreeIcon, Loader2, MoreHorizontal,
  Move, Pencil, Plus, Trash2, X,
} from "lucide-react";

export type FolderNode = {
  id: string;
  parentId: string | null;
  name: string;
  color: string;
  status: string;
  category: string;
  ownDocs: number;
  deepDocs: number;
  correspondents: number;
  tags: number;
  dueLabel: string | null;
  updatedLabel: string;
  path: string;
  level: number;
  children: FolderNode[];
};

const COLORS = ["#F97316", "#2563EB", "#16A34A", "#7C3AED", "#0EA5E9", "#DC2626", "#D97706", "#64748B"];

/** Dossier brut renvoyé par /api/projects (sous-ensemble utile à l'arbre). */
export type RawFolder = {
  id: string;
  parentId: string | null;
  name: string;
  color: string;
  status: string;
  category: string;
  linkedDocumentIds: number[];
  linkedCorrespondentIds: number[];
  linkedTagIds: number[];
  dueDate: string | null;
  updatedAt: string;
};

/** Construit l'arbre `FolderNode[]` côté client (path/level/compteur profond). */
export function buildFolderNodes(folders: RawFolder[]): FolderNode[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const pathOf = (f: RawFolder): string => {
    const names: string[] = []; const seen = new Set<string>(); let cur: RawFolder | undefined = f;
    while (cur && !seen.has(cur.id)) { names.unshift(cur.name); seen.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    return names.join(" / ");
  };
  const descIds = (id: string): string[] => {
    const out: string[] = []; const stack = [id]; const seen = new Set<string>([id]);
    while (stack.length) { const c = stack.pop()!; for (const f of folders) if ((f.parentId ?? null) === c && !seen.has(f.id)) { seen.add(f.id); out.push(f.id); stack.push(f.id); } }
    return out;
  };
  const deepDocs = (id: string): number => {
    const ids = new Set<number>();
    for (const t of [id, ...descIds(id)]) { const f = byId.get(t); if (f) for (const d of f.linkedDocumentIds ?? []) ids.add(d); }
    return ids.size;
  };
  const build = (parentId: string | null, level: number): FolderNode[] =>
    folders
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .map((f) => ({
        id: f.id, parentId: f.parentId ?? null, name: f.name, color: f.color || "#F97316",
        status: f.status, category: f.category,
        ownDocs: (f.linkedDocumentIds ?? []).length, deepDocs: deepDocs(f.id),
        correspondents: (f.linkedCorrespondentIds ?? []).length, tags: (f.linkedTagIds ?? []).length,
        dueLabel: f.dueDate ?? null, updatedLabel: "", path: pathOf(f), level,
        children: build(f.id, level + 1),
      }));
  return build(null, 0);
}

function flatten(tree: FolderNode[]): { all: FolderNode[]; byId: Map<string, FolderNode> } {
  const all: FolderNode[] = [];
  const byId = new Map<string, FolderNode>();
  const walk = (nodes: FolderNode[]) => nodes.forEach((n) => { all.push(n); byId.set(n.id, n); walk(n.children); });
  walk(tree);
  return { all, byId };
}

function descendantSet(node: FolderNode): Set<string> {
  const set = new Set<string>();
  const walk = (n: FolderNode) => n.children.forEach((c) => { set.add(c.id); walk(c); });
  walk(node);
  return set;
}

/** Ancêtres d'un dossier (pour déplier le chemin jusqu'au dossier sélectionné). */
function ancestorIds(id: string | null, byId: Map<string, FolderNode>): string[] {
  const out: string[] = [];
  let cur = id ? byId.get(id) : undefined;
  const seen = new Set<string>();
  while (cur && cur.parentId && !seen.has(cur.parentId)) {
    out.push(cur.parentId);
    seen.add(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return out;
}

/**
 * Panneau-explorateur de dossiers (style Finder/Explorer) : arbre dépliable à
 * gauche. La sélection navigue vers `?folder=<id>` (les documents du dossier
 * sont affichés au centre par la page). Gère création/renommage/déplacement/
 * suppression de dossiers.
 */
export function FolderExplorer({
  tree,
  currentId,
  variant = "panel",
  onNavigate,
  onChanged,
}: {
  tree: FolderNode[];
  currentId: string | null;
  /** "panel" = colonne autonome ; "sidebar" = intégré à la barre d'espace. */
  variant?: "panel" | "sidebar";
  onNavigate?: () => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const { all, byId } = useMemo(() => flatten(tree), [tree]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([...tree.map((n) => n.id), ...ancestorIds(currentId, byId)]));
  const [busy, setBusy] = useState(false);

  const [createUnder, setCreateUnder] = useState<{ parentId: string | null; parentName: string } | null>(null);
  const [renaming, setRenaming] = useState<FolderNode | null>(null);
  const [moving, setMoving] = useState<FolderNode | null>(null);
  const [deleting, setDeleting] = useState<FolderNode | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function select(id: string) {
    router.push(`/organiser/dossiers?folder=${id}`);
    onNavigate?.();
  }

  async function api(path: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(path, { credentials: "include", ...init });
      if (res.ok) { router.refresh(); onChanged?.(); }
      else { const d = await res.json().catch(() => ({})); alert(d.error ?? `Erreur ${res.status}`); }
      return res.ok;
    } finally { setBusy(false); }
  }
  async function createFolder(name: string, parentId: string | null, color: string, description: string) {
    const ok = await api("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentId, color, description }) });
    if (ok) setCreateUnder(null);
  }
  function patchFolder(id: string, body: Record<string, unknown>) {
    return api(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async function removeFolder(id: string, mode: "reparent" | "cascade") {
    const ok = await api(`/api/projects/${id}?mode=${mode}`, { method: "DELETE" });
    if (ok) setDeleting(null);
  }

  function renderRow(node: FolderNode) {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    const isActive = node.id === currentId;
    return (
      <div key={node.id}>
        <div
          className="group flex items-center gap-0.5 rounded-lg pr-0.5 transition hover:bg-slate-50"
          style={{ paddingLeft: `${node.level * 14 + 2}px`, background: isActive ? "rgba(249,115,22,0.10)" : undefined }}
        >
          <button type="button" onClick={() => hasChildren && toggle(node.id)} aria-label={isOpen ? "Replier" : "Déplier"} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-700" style={{ visibility: hasChildren ? "visible" : "hidden" }}>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => select(node.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: node.color }} aria-hidden="true" />
            {renaming?.id === node.id ? (
              <InlineRename initial={node.name} busy={busy} onCommit={(v) => { if (v && v !== node.name) void patchFolder(node.id, { name: v }); setRenaming(null); }} onCancel={() => setRenaming(null)} />
            ) : (
              <span className="truncate text-[12.5px] font-semibold" style={{ color: isActive ? "#C2410C" : "var(--text-main)" }}>{node.name}</span>
            )}
            {node.deepDocs > 0 ? <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#F1F5F9", color: "#64748B" }}>{node.deepDocs}</span> : null}
          </button>
          <RowMenu
            onAddSub={() => setCreateUnder({ parentId: node.id, parentName: node.path })}
            onRename={() => setRenaming(node)}
            onMove={() => setMoving(node)}
            onDelete={() => setDeleting(node)}
            onColor={(c) => void patchFolder(node.id, { color: c })}
          />
        </div>
        {hasChildren && isOpen ? node.children.map(renderRow) : null}
      </div>
    );
  }

  const sidebar = variant === "sidebar";
  return (
    <div className={sidebar ? "flex min-h-0 w-full flex-1 flex-col" : "w-full lg:w-72 lg:shrink-0"}>
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          <FolderTreeIcon className="h-3.5 w-3.5" strokeWidth={1.85} /> Dossiers
        </p>
        <button type="button" onClick={() => setCreateUnder({ parentId: null, parentName: "Racine" })} aria-label="Nouveau dossier" title="Nouveau dossier" className="flex h-7 w-7 items-center justify-center rounded-lg text-white transition hover:opacity-90" style={{ background: "#F97316" }}>
          <FolderPlus className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <div
        className={sidebar ? "min-h-0 flex-1 overflow-y-auto pb-2" : "max-h-[calc(100vh-220px)] overflow-y-auto rounded-2xl bg-white p-1.5"}
        style={sidebar ? undefined : { boxShadow: "var(--shadow-card)" }}
      >
        {tree.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <FolderTreeIcon className="mx-auto mb-2 h-7 w-7" style={{ color: "var(--text-hint)" }} strokeWidth={1.5} />
            <p className="text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>Aucun dossier</p>
            <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>Créez un dossier, puis des sous-dossiers.</p>
          </div>
        ) : tree.map(renderRow)}
      </div>

      {createUnder ? (
        <NewFolderDialog parentName={createUnder.parentName} busy={busy} onClose={() => setCreateUnder(null)} onCreate={(name, color, desc) => void createFolder(name, createUnder.parentId, color, desc)} />
      ) : null}
      {moving ? (
        <MoveDialog node={moving} all={all} busy={busy} onClose={() => setMoving(null)} onMove={async (parentId) => { const ok = await patchFolder(moving.id, { parentId }); if (ok) setMoving(null); }} />
      ) : null}
      {deleting ? (
        <DeleteDialog node={deleting} busy={busy} onClose={() => setDeleting(null)} onDelete={(mode) => void removeFolder(deleting.id, mode)} />
      ) : null}
    </div>
  );
}

const inputCls = "h-10 w-full rounded-xl border px-3 text-[13px] outline-none focus:border-[var(--accent)]";

function InlineRename({ initial, busy, onCommit, onCancel }: { initial: string; busy: boolean; onCommit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <input autoFocus value={v} disabled={busy} onChange={(e) => setV(e.target.value)} onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Enter") onCommit(v.trim()); if (e.key === "Escape") onCancel(); }}
      onBlur={() => onCommit(v.trim())}
      className="h-7 min-w-0 flex-1 rounded border px-1.5 text-[12.5px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
  );
}

function RowMenu({ onAddSub, onRename, onMove, onDelete, onColor }: { onAddSub: () => void; onRename: () => void; onMove: () => void; onDelete: () => void; onColor: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} aria-label="Actions du dossier" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100">
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-8 z-40 w-52 rounded-xl border bg-white py-1 shadow-lg" style={{ borderColor: "var(--border)" }}>
            <MenuItem icon={Plus} label="Ajouter un sous-dossier" onClick={() => { setOpen(false); onAddSub(); }} />
            <MenuItem icon={Pencil} label="Renommer" onClick={() => { setOpen(false); onRename(); }} />
            <MenuItem icon={Move} label="Déplacer vers…" onClick={() => { setOpen(false); onMove(); }} />
            <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              {COLORS.map((c) => <button key={c} type="button" aria-label={`Couleur ${c}`} onClick={() => { setOpen(false); onColor(c); }} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c }} />)}
            </div>
            <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
            <MenuItem icon={Trash2} label="Supprimer" danger onClick={() => { setOpen(false); onDelete(); }} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Plus; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-semibold hover:bg-[#FCFAF7]" style={{ color: danger ? "#DC2626" : "var(--text-main)" }}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} /> {label}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" style={{ border: "1px solid var(--border)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewFolderDialog({ parentName, busy, onClose, onCreate }: { parentName: string; busy: boolean; onClose: () => void; onCreate: (name: string, color: string, desc: string) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  return (
    <Modal title="Nouveau dossier" onClose={onClose}>
      <p className="mb-2 text-[12px]" style={{ color: "var(--text-muted)" }}>Dans : <b style={{ color: "var(--text-main)" }}>{parentName}</b></p>
      <div className="space-y-2">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du dossier" className={inputCls} style={{ borderColor: "var(--border)" }} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onCreate(name.trim(), color, desc.trim()); }} />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optionnel)" className={inputCls} style={{ borderColor: "var(--border)" }} />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Couleur :</span>
          {COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className="h-5 w-5 rounded-full" style={{ background: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none" }} />)}
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-full border px-4 text-[13px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Annuler</button>
        <button type="button" disabled={!name.trim() || busy} onClick={() => onCreate(name.trim(), color, desc.trim())} className="inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: "#F97316" }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Créer</button>
      </div>
    </Modal>
  );
}

function MoveDialog({ node, all, busy, onClose, onMove }: { node: FolderNode; all: FolderNode[]; busy: boolean; onClose: () => void; onMove: (parentId: string | null) => void }) {
  const blocked = useMemo(() => { const s = descendantSet(node); s.add(node.id); return s; }, [node]);
  const options = all.filter((f) => !blocked.has(f.id)).sort((a, b) => a.path.localeCompare(b.path, "fr"));
  const [target, setTarget] = useState<string | "">("");
  return (
    <Modal title={`Déplacer « ${node.name} »`} onClose={onClose}>
      <p className="mb-2 text-[12px]" style={{ color: "var(--text-muted)" }}>Choisissez le nouveau dossier parent (ou la racine).</p>
      <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls} style={{ borderColor: "var(--border)" }}>
        <option value="">— Racine (aucun parent) —</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.path}</option>)}
      </select>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-full border px-4 text-[13px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => onMove(target || null)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: "#F97316" }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Déplacer</button>
      </div>
    </Modal>
  );
}

function DeleteDialog({ node, busy, onClose, onDelete }: { node: FolderNode; busy: boolean; onClose: () => void; onDelete: (mode: "reparent" | "cascade") => void }) {
  const subCount = useMemo(() => descendantSet(node).size, [node]);
  const [mode, setMode] = useState<"reparent" | "cascade">("reparent");
  return (
    <Modal title={`Supprimer « ${node.name} » ?`} onClose={onClose}>
      <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        Ce dossier contient <b>{subCount}</b> sous-dossier{subCount > 1 ? "s" : ""} et <b>{node.deepDocs}</b> document{node.deepDocs > 1 ? "s" : ""} lié{node.deepDocs > 1 ? "s" : ""}. Les documents ne sont <b>jamais</b> supprimés (ils restent dans la GED).
      </p>
      {subCount > 0 ? (
        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-2 rounded-lg border p-2 text-[12.5px]" style={{ borderColor: mode === "reparent" ? "#F97316" : "var(--border)", color: "var(--text-main)" }}>
            <input type="radio" name="del-mode" checked={mode === "reparent"} onChange={() => setMode("reparent")} className="mt-0.5" />
            <span>Supprimer <b>seulement ce dossier</b> — les sous-dossiers remontent au niveau supérieur.</span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border p-2 text-[12.5px]" style={{ borderColor: mode === "cascade" ? "#DC2626" : "var(--border)", color: "var(--text-main)" }}>
            <input type="radio" name="del-mode" checked={mode === "cascade"} onChange={() => setMode("cascade")} className="mt-0.5" />
            <span>Supprimer ce dossier <b>et tous ses sous-dossiers</b>.</span>
          </label>
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-full border px-4 text-[13px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => onDelete(mode)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: mode === "cascade" ? "#DC2626" : "#F97316" }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={1.85} />}
          {mode === "cascade" ? "Supprimer l'arbre" : "Supprimer"}
        </button>
      </div>
    </Modal>
  );
}
