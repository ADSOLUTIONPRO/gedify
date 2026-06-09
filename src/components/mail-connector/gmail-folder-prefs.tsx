"use client";

import { useEffect, useState } from "react";
import { FolderCheck, FolderX, Loader2, Lock } from "lucide-react";

/* Configuration des dossiers/labels Gmail inclus dans « Courriels à traiter »
   (§13). Les dossiers système (Envoyés, Brouillons, Spam, Corbeille, catégories)
   sont verrouillés et toujours exclus ; les libellés personnels sont cochables. */

type Folder = {
  id: string;
  name: string;
  kind: "system" | "user";
  included: boolean;
  locked: boolean;
  reason?: string;
};

const REASON_LABEL: Record<string, string> = {
  system_sent_folder: "Envoyés",
  system_draft_folder: "Brouillons",
  system_spam_folder: "Spam",
  system_trash_folder: "Corbeille",
  system_chat: "Chats",
  system_category: "Catégorie",
};

export function GmailFolderPrefs({ accountId }: { accountId: string }) {
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/messaging/accounts/${accountId}/labels`, { credentials: "include", cache: "no-store" });
        const d = (await res.json().catch(() => ({}))) as { folders?: Folder[]; message?: string; error?: string };
        if (cancelled) return;
        if (!res.ok) { setError(d.error ?? "Lecture impossible."); return; }
        setFolders(d.folders ?? []);
      } catch {
        if (!cancelled) setError("Lecture impossible.");
      }
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  async function toggle(f: Folder) {
    if (f.locked || busyId) return;
    const next = !f.included;
    setBusyId(f.id);
    // Optimiste.
    setFolders((prev) => prev?.map((x) => (x.id === f.id ? { ...x, included: next } : x)) ?? prev);
    try {
      const res = await fetch(`/api/messaging/accounts/${accountId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderId: f.id, folderName: f.name, included: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Rollback en cas d'échec.
      setFolders((prev) => prev?.map((x) => (x.id === f.id ? { ...x, included: f.included } : x)) ?? prev);
      setError("Mise à jour impossible.");
    } finally {
      setBusyId(null);
    }
  }

  if (error && !folders) {
    return <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>{error}</p>;
  }
  if (!folders) {
    return (
      <p className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des dossiers…
      </p>
    );
  }

  const synced = folders.filter((f) => f.included);
  const excludedSystem = folders.filter((f) => !f.included && f.locked);
  const excludedManual = folders.filter((f) => !f.included && !f.locked);

  return (
    <div className="space-y-4">
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        Les libellés cochés alimentent « Courriels à traiter ». Les dossiers système restent toujours exclus.
      </p>

      <FolderGroup title={`Dossiers synchronisés (${synced.length})`}>
        {synced.map((f) => (
          <FolderRow key={f.id} folder={f} busy={busyId === f.id} onToggle={() => void toggle(f)} />
        ))}
        {excludedManual.map((f) => (
          <FolderRow key={f.id} folder={f} busy={busyId === f.id} onToggle={() => void toggle(f)} />
        ))}
        {synced.length + excludedManual.length === 0 ? (
          <p className="px-1 py-2 text-[12px]" style={{ color: "var(--text-hint)" }}>Aucun libellé personnel.</p>
        ) : null}
      </FolderGroup>

      <FolderGroup title="Dossiers exclus automatiquement">
        {excludedSystem.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
            <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
              <Lock className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" />
              {f.name}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: "var(--text-hint)" }}>
              {f.reason ? REASON_LABEL[f.reason] ?? "Système" : "Système"} · verrouillé
            </span>
          </div>
        ))}
      </FolderGroup>
    </div>
  );
}

function FolderGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "var(--text-hint)" }}>{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FolderRow({ folder, busy, onToggle }: { folder: Folder; busy: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition hover:bg-[var(--bg-card-soft)] disabled:opacity-60"
      style={{ borderColor: folder.included ? "var(--border)" : "var(--border-soft)" }}
    >
      <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: folder.included ? "var(--text-main)" : "var(--text-muted)" }}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : folder.included ? <FolderCheck className="h-3.5 w-3.5" strokeWidth={1.85} style={{ color: "var(--gedify-green)" }} /> : <FolderX className="h-3.5 w-3.5" strokeWidth={1.85} />}
        {folder.name}
      </span>
      <span className="text-[11px] font-bold" style={{ color: folder.included ? "var(--gedify-green)" : "var(--text-hint)" }}>
        {folder.included ? "Inclus" : "Exclu"}
      </span>
    </button>
  );
}
