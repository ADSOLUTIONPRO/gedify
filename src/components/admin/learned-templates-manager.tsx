"use client";

import { useEffect, useState } from "react";
import { Brain, FolderTree, Loader2, Power, Tag, Trash2, Users } from "lucide-react";

type LearnedTemplate = {
  id: string;
  label: string;
  documentType: string | null;
  primaryCorrespondent: string | null;
  tags: string[];
  folder: string | null;
  validatedCount: number;
  lastValidatedAt: string;
  active: boolean;
};

/**
 * Gestion des modèles de classement appris : liste, activer/désactiver,
 * supprimer. La fusion et le journal d'erreurs viendront plus tard.
 */
export function LearnedTemplatesManager() {
  const [items, setItems] = useState<LearnedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/learned-templates", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: LearnedTemplate[] }) => { if (!cancelled) { setItems(d.items ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function toggle(t: LearnedTemplate) {
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/ai/learned-templates/${t.id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      });
      if (res.ok) setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: !x.active } : x)));
    } finally { setBusyId(null); }
  }

  async function remove(t: LearnedTemplate) {
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/ai/learned-templates/${t.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) setItems((prev) => prev.filter((x) => x.id !== t.id));
    } finally { setBusyId(null); }
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
        <Brain className="mx-auto mb-3 h-9 w-9" style={{ color: "var(--text-hint)" }} strokeWidth={1.5} />
        <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Aucun modèle appris pour l&apos;instant</p>
        <p className="mx-auto mt-1 max-w-md text-[12.5px]" style={{ color: "var(--text-muted)" }}>Validez des analyses IA depuis vos documents : Gedify mémorisera automatiquement des modèles de classement réutilisables pour les documents similaires.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3.5" style={{ borderColor: "var(--border)", opacity: t.active ? 1 : 0.6 }}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Brain className="h-5 w-5" strokeWidth={1.85} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>{t.label}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              {t.documentType ? <span>{t.documentType}</span> : null}
              {t.primaryCorrespondent ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" strokeWidth={1.75} /> {t.primaryCorrespondent}</span> : null}
              {t.folder ? <span className="inline-flex items-center gap-1"><FolderTree className="h-3 w-3" strokeWidth={1.75} /> {t.folder}</span> : null}
              {t.tags.length > 0 ? <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" strokeWidth={1.75} /> {t.tags.slice(0, 4).join(", ")}</span> : null}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#EAF8EF", color: "#15803D" }}>{t.validatedCount} validation{t.validatedCount > 1 ? "s" : ""}</span>
            <span className="text-[10.5px]" style={{ color: "var(--text-hint)" }}>maj {new Date(t.lastValidatedAt).toLocaleDateString("fr-FR")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={busyId === t.id} onClick={() => void toggle(t)} title={t.active ? "Désactiver" : "Activer"} className="flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold transition hover:bg-[#FCFAF7] disabled:opacity-50" style={{ borderColor: "var(--border)", color: t.active ? "#15803D" : "var(--text-muted)" }}>
              <Power className="h-4 w-4" strokeWidth={1.85} /> {t.active ? "Actif" : "Inactif"}
            </button>
            <button type="button" disabled={busyId === t.id} onClick={() => void remove(t)} aria-label="Supprimer" className="flex h-9 w-9 items-center justify-center rounded-lg border transition hover:bg-rose-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
              <Trash2 className="h-4 w-4" strokeWidth={1.85} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
