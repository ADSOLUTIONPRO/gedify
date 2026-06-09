"use client";

import { useState } from "react";
import { FileText, Loader2, RotateCcw, Save } from "lucide-react";

/* Panneau « GED & documents » embarqué dans la page Administration (/administration).
   Seul réglage réellement paramétrable restant : l'analyse IA automatique à
   l'import. L'OCR/indexation sont automatiques (statut). L'ancienne page
   /administration/parametres (et son menu d'ancres) est supprimée → redirection. */

type Flags = { financeSpaceEnabled: boolean; autoBudgetClassificationEnabled: boolean; autoAiAnalysisEnabled: boolean; autoContactSyncEnabled: boolean };

export function AdminConfigPanel({ initialFlags }: { initialFlags: Flags }) {
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [saved, setSaved] = useState<Flags>(initialFlags);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = flags.autoAiAnalysisEnabled !== saved.autoAiAnalysisEnabled;

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/settings/features", {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(flags),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; flags?: Flags };
      if (res.ok && d.flags) { setSaved(d.flags); setFlags(d.flags); setMsg("Enregistré."); }
      else setMsg("Échec de l'enregistrement.");
    } finally { setSaving(false); setTimeout(() => setMsg(null), 3000); }
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0" strokeWidth={1.85} style={{ color: "var(--accent)" }} aria-hidden="true" />
          <h3 className="truncate text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>GED &amp; documents</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {msg ? <span className="text-[12px] font-semibold" style={{ color: "var(--gedify-green)" }}>{msg}</span> : null}
          {dirty ? (
            <>
              <button type="button" onClick={() => setFlags(saved)} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12.5px] font-semibold transition hover:bg-[var(--bg-card-soft)] disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.85} /> Annuler
              </button>
              <button type="button" onClick={save} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />} Enregistrer
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5 px-4 py-3">
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>Analyse IA automatique à l&apos;import</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Analyse les documents dès l&apos;import (l&apos;analyse manuelle reste possible).</p>
          </div>
          <button type="button" role="switch" aria-checked={flags.autoAiAnalysisEnabled} aria-label="Analyse IA automatique à l'import"
            onClick={() => setFlags((f) => ({ ...f, autoAiAnalysisEnabled: !f.autoAiAnalysisEnabled }))}
            className="relative h-5 w-9 shrink-0 rounded-full transition" style={{ background: flags.autoAiAnalysisEnabled ? "var(--accent)" : "var(--border-strong)" }}>
            <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: flags.autoAiAnalysisEnabled ? "18px" : "2px" }} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 text-[12.5px]">
          <span style={{ color: "var(--text-muted)" }}>OCR &amp; indexation</span>
          <span className="font-semibold" style={{ color: "var(--gedify-green)" }}>Automatiques</span>
        </div>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-hint)" }}>L&apos;OCR et l&apos;indexation s&apos;exécutent automatiquement en arrière-plan après chaque import.</p>
      </div>
    </section>
  );
}
