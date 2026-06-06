"use client";

import { useEffect, useState } from "react";
import {
  Brain, ChevronDown, Copy, FlaskConical, FolderTree, Loader2, Power,
  RotateCcw, Save, Tag, Trash2, TriangleAlert, Users,
} from "lucide-react";

type Tpl = {
  id: string;
  label: string;
  documentType: string | null;
  primaryCorrespondent: string | null;
  tags: string[];
  folder: string | null;
  validatedCount: number;
  lastValidatedAt: string;
  active: boolean;
  description?: string | null;
  promptSystem?: string | null;
  promptInstructions?: string | null;
  version?: number;
  updatedAt?: string;
  updatedBy?: string | null;
  exampleDocumentIds?: number[];
  previousPrompt?: { at: string } | null;
};

type Draft = { label: string; description: string; promptSystem: string; promptInstructions: string };
type TestState = { docId: string; text: string; running: boolean; result: unknown | null; error: string | null };

const SECRET_RE = /\bsk-[A-Za-z0-9_-]{16,}/;
const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export function LearnedTemplatesManager() {
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [test, setTest] = useState<TestState>({ docId: "", text: "", running: false, result: null, error: null });
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function reload() {
    fetch("/api/ai/learned-templates", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Tpl[] }) => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  function openEditor(t: Tpl) {
    if (openId === t.id) { setOpenId(null); return; }
    setOpenId(t.id);
    setDraft({
      label: t.label ?? "",
      description: t.description ?? "",
      promptSystem: t.promptSystem ?? "",
      promptInstructions: t.promptInstructions ?? "",
    });
    setTest({ docId: "", text: "", running: false, result: null, error: null });
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/ai/learned-templates/${id}`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { item?: Tpl; error?: string };
    if (!res.ok || !data.item) throw new Error(data.error ?? "Échec de l'enregistrement.");
    setItems((prev) => prev.map((x) => (x.id === id ? data.item! : x)));
    return data.item;
  }

  async function save(id: string) {
    if (!draft) return;
    if (SECRET_RE.test(draft.promptSystem) || SECRET_RE.test(draft.promptInstructions)) {
      setTest((s) => ({ ...s, error: "Le prompt contient ce qui ressemble à une clé secrète (sk-…). Retirez-la." }));
      return;
    }
    setBusyId(id);
    try {
      await patch(id, { label: draft.label, description: draft.description, promptSystem: draft.promptSystem, promptInstructions: draft.promptInstructions });
      setTest((s) => ({ ...s, error: null }));
    } catch (e) {
      setTest((s) => ({ ...s, error: e instanceof Error ? e.message : "Échec." }));
    } finally { setBusyId(null); }
  }

  async function toggle(t: Tpl) {
    setBusyId(t.id);
    try { await patch(t.id, { active: !t.active }); } catch { /* ignore */ } finally { setBusyId(null); }
  }

  async function restorePrompt(id: string) {
    setBusyId(id);
    try {
      const item = await patch(id, { restorePrompt: true });
      setDraft((d) => d ? { ...d, promptSystem: item.promptSystem ?? "", promptInstructions: item.promptInstructions ?? "" } : d);
    } catch { /* ignore */ } finally { setBusyId(null); }
  }

  async function duplicate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/ai/learned-templates/${id}/duplicate`, { method: "POST", credentials: "include" });
      if (res.ok) reload();
    } finally { setBusyId(null); }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/ai/learned-templates/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) { setItems((prev) => prev.filter((x) => x.id !== id)); setOpenId(null); }
    } finally { setBusyId(null); setConfirmDel(null); }
  }

  async function runTest(id: string) {
    setTest((s) => ({ ...s, running: true, result: null, error: null }));
    try {
      const payload: Record<string, unknown> = {};
      if (test.docId.trim()) payload.documentId = Number(test.docId.trim());
      else if (test.text.trim()) payload.text = test.text.trim();
      else { setTest((s) => ({ ...s, running: false, error: "Indiquez un n° de document ou collez un texte." })); return; }
      const res = await fetch(`/api/ai/learned-templates/${id}/test`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Test impossible.");
      setTest((s) => ({ ...s, running: false, result: data.result ?? null }));
    } catch (e) {
      setTest((s) => ({ ...s, running: false, error: e instanceof Error ? e.message : "Test impossible." }));
    }
  }

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} /></div>;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
        <Brain className="mx-auto mb-3 h-9 w-9" style={{ color: "var(--text-hint)" }} strokeWidth={1.5} />
        <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Aucun modèle appris pour l&apos;instant</p>
        <p className="mx-auto mt-1 max-w-md text-[12.5px]" style={{ color: "var(--text-muted)" }}>Validez des analyses IA depuis vos documents : Gedify mémorisera des modèles de classement réutilisables.</p>
      </div>
    );
  }

  const promptTooLong = draft ? (draft.promptSystem.length > 8000 || draft.promptInstructions.length > 8000) : false;
  const promptHasSecret = draft ? (SECRET_RE.test(draft.promptSystem) || SECRET_RE.test(draft.promptInstructions)) : false;

  return (
    <div className="space-y-2.5">
      {items.map((t) => {
        const open = openId === t.id;
        const used = t.exampleDocumentIds?.length ?? 0;
        return (
          <div key={t.id} className="rounded-2xl border bg-white" style={{ borderColor: "var(--border)", opacity: t.active ? 1 : 0.7 }}>
            {/* En-tête (cliquable) */}
            <div className="flex flex-wrap items-center gap-3 p-3.5">
              <button type="button" onClick={() => openEditor(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Brain className="h-5 w-5" strokeWidth={1.85} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>{t.label}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                    {t.documentType ? <span>{t.documentType}</span> : null}
                    {t.primaryCorrespondent ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {t.primaryCorrespondent}</span> : null}
                    {t.folder ? <span className="inline-flex items-center gap-1"><FolderTree className="h-3 w-3" /> {t.folder}</span> : null}
                    {t.tags?.length ? <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {t.tags.slice(0, 4).join(", ")}</span> : null}
                    {t.promptSystem || t.promptInstructions ? <span className="rounded bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-700">prompt perso</span> : null}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
              </button>
              <div className="flex flex-col items-end gap-0.5">
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#EAF8EF", color: "#15803D" }}>{t.validatedCount} valid.</span>
                <span className="text-[10.5px]" style={{ color: "var(--text-hint)" }}>maj {new Date(t.updatedAt ?? t.lastValidatedAt).toLocaleDateString("fr-FR")}{t.version ? ` · v${t.version}` : ""}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={busyId === t.id} onClick={() => void toggle(t)} title={t.active ? "Désactiver" : "Activer"} className="flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold transition hover:bg-[#FCFAF7] disabled:opacity-50" style={{ borderColor: "var(--border)", color: t.active ? "#15803D" : "var(--text-muted)" }}><Power className="h-4 w-4" /> {t.active ? "Actif" : "Inactif"}</button>
                <button type="button" disabled={busyId === t.id} onClick={() => void duplicate(t.id)} aria-label="Dupliquer" title="Dupliquer" className="flex h-9 w-9 items-center justify-center rounded-lg border transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><Copy className="h-4 w-4" /></button>
                <button type="button" disabled={busyId === t.id} onClick={() => setConfirmDel(t.id)} aria-label="Supprimer" title="Supprimer" className="flex h-9 w-9 items-center justify-center rounded-lg border transition hover:bg-rose-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--danger)" }}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Confirmation suppression */}
            {confirmDel === t.id ? (
              <div className="flex items-center justify-end gap-2 border-t px-3.5 py-2.5" style={{ borderColor: "var(--border)", background: "#FEF2F2" }}>
                <span className="mr-auto text-[12.5px] font-semibold text-rose-700">Supprimer définitivement ce modèle ?</span>
                <button type="button" onClick={() => setConfirmDel(null)} className="h-8 rounded-lg border px-3 text-[12.5px] font-semibold" style={{ borderColor: "var(--border)" }}>Annuler</button>
                <button type="button" disabled={busyId === t.id} onClick={() => void remove(t.id)} className="h-8 rounded-lg px-3 text-[12.5px] font-bold text-white disabled:opacity-50" style={{ background: "var(--danger)" }}>Supprimer</button>
              </div>
            ) : null}

            {/* Fiche détail / éditeur */}
            {open && draft ? (
              <div className="space-y-3 border-t p-4" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
                {/* Identité : nom + description sur une ligne */}
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Nom</span>
                    <input value={draft.label} onChange={(e) => setDraft((d) => d && { ...d, label: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Description</span>
                    <input value={draft.description} onChange={(e) => setDraft((d) => d && { ...d, description: e.target.value })} placeholder="À quoi sert ce modèle ?" className={inputCls} />
                  </label>
                </div>

                {/* Prompt IA — fond violet, les 2 zones côte à côte */}
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--gedify-purple)", background: "var(--gedify-purple-soft)" }}>
                  <p className="mb-2 text-[12px] font-bold text-violet-700">Prompt IA du modèle</p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-500">Prompt système (consignes IA propres à ce modèle)</span>
                      <textarea value={draft.promptSystem} onChange={(e) => setDraft((d) => d && { ...d, promptSystem: e.target.value })} rows={5} placeholder="Ex. Ce document est une facture d'énergie. Concentre-toi sur le montant TTC et l'échéance…" className={`${inputCls} resize-y font-mono text-[12px]`} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-500">Instructions complémentaires (à extraire, format attendu, ce qu&apos;il ne faut PAS faire)</span>
                      <textarea value={draft.promptInstructions} onChange={(e) => setDraft((d) => d && { ...d, promptInstructions: e.target.value })} rows={5} placeholder="Ex. Extrais toujours la date d'échéance. N'invente jamais de correspondant…" className={`${inputCls} resize-y font-mono text-[12px]`} />
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {promptHasSecret ? <span className="flex items-center gap-1.5 text-[12px] font-semibold text-rose-600"><TriangleAlert className="h-3.5 w-3.5" /> Clé secrète détectée (sk-…). Retirez-la.</span> : null}
                    {promptTooLong ? <span className="text-[12px] font-semibold text-amber-600">Prompt très long (max 8000, tronqué).</span> : null}
                    {t.previousPrompt ? (
                      <button type="button" disabled={busyId === t.id} onClick={() => void restorePrompt(t.id)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:underline"><RotateCcw className="h-3.5 w-3.5" /> Restaurer la version précédente</button>
                    ) : null}
                  </div>
                </div>

                {/* Tester — fond bleu */}
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--gedify-info)", background: "var(--gedify-info-soft)" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--text-main)" }}><FlaskConical className="h-4 w-4 text-blue-600" /> Tester (simulation)</p>
                    <input value={test.docId} onChange={(e) => setTest((s) => ({ ...s, docId: e.target.value, text: "" }))} placeholder="N° de document" className={`${inputCls} max-w-36`} />
                    <span className="text-[12px] text-slate-400">ou</span>
                    <input value={test.text} onChange={(e) => setTest((s) => ({ ...s, text: e.target.value, docId: "" }))} placeholder="coller un texte…" className={`${inputCls} flex-1 min-w-40`} />
                    <button type="button" disabled={test.running} onClick={() => void runTest(t.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-white disabled:opacity-50" style={{ background: "var(--blue-600)" }}>{test.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Tester</button>
                  </div>
                  {test.result ? (
                    <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{JSON.stringify(test.result, null, 2)}</pre>
                  ) : null}
                </div>

                {test.error ? <p className="text-[12.5px] font-semibold text-rose-600">{test.error}</p> : null}

                <div className="flex items-center gap-2">
                  <button type="button" disabled={busyId === t.id || promptHasSecret} onClick={() => void save(t.id)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--blue-600)" }}>{busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button>
                  <button type="button" onClick={() => setOpenId(null)} className="inline-flex h-9 items-center rounded-xl border px-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>Fermer</button>
                  <span className="ml-auto text-[11px] text-slate-400">{used > 0 ? `Utilisé par ${used} document${used > 1 ? "s" : ""}` : "Aucun document associé"}{t.updatedBy ? ` · par ${t.updatedBy}` : ""}</span>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
