"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { FileText, Info, Loader2, RotateCcw, Save } from "lucide-react";

/* ── Administration › Paramètres — page simplifiée. Ne conserve que les réglages
   réellement paramétrables (GED & documents) + « À propos ». Les anciens blocs
   de synthèse (sécurité, interface, emails, finances, contacts, office,
   sauvegarde, stockage, champs perso, journaux, workflows, agenda, modules)
   faisaient doublon avec les vrais espaces → supprimés du DOM. ── */

export type AdminSettingsProps = {
  engine: { connected: boolean; version: string | null; apiVersion: string | null; error: string | null };
  initialFlags: { financeSpaceEnabled: boolean; autoBudgetClassificationEnabled: boolean; autoAiAnalysisEnabled: boolean; autoContactSyncEnabled: boolean };
};

type Flags = AdminSettingsProps["initialFlags"];
type SectionTone = "green" | "blue";

const SECTIONS: { id: string; label: string; icon: React.ElementType }[] = [
  { id: "ged-documents", label: "GED & documents", icon: FileText },
  { id: "a-propos", label: "À propos de Gedify", icon: Info },
];

export function AdministrationSettings({ engine, initialFlags }: AdminSettingsProps) {
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [saved, setSaved] = useState<Flags>(initialFlags);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [active, setActive] = useState(SECTIONS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seul réglage éditable restant sur cette page : l'analyse IA à l'import.
  const dirty = flags.autoAiAnalysisEnabled !== saved.autoAiAnalysisEnabled;

  // Scroll-spy indépendant du nombre de colonnes (positions relatives au conteneur).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let raf = 0;
    const compute = () => {
      const rootTop = root.getBoundingClientRect().top;
      const line = 130;
      let currentId = SECTIONS[0]?.id ?? "";
      let best = -Infinity;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - rootTop;
        if (top <= line && top > best) { best = top; currentId = s.id; }
      }
      if (currentId) setActive(currentId);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(compute); };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(raf); root.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  function goToSection(e: MouseEvent, id: string) {
    e.preventDefault();
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof history !== "undefined") history.replaceState(null, "", `#${id}`);
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/settings/features", {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(flags),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; flags?: Flags };
      if (res.ok && d.flags) { setSaved(d.flags); setFlags(d.flags); setMsg("Paramètres enregistrés."); }
      else setMsg("Échec de l'enregistrement.");
    } finally { setSaving(false); setTimeout(() => setMsg(null), 3000); }
  }
  function cancel() { setFlags(saved); }

  return (
    <div ref={scrollRef} className="h-[calc(100vh-53px)] overflow-y-auto scroll-smooth" style={{ background: "var(--bg-page)" }}>
      {/* En-tête sticky + Enregistrer */}
      <div className="sticky top-0 z-20 border-b px-5 py-3" style={{ background: "color-mix(in srgb, var(--bg-page) 88%, transparent)", backdropFilter: "blur(6px)", borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Administration · Paramètres</p>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>Paramètres</h1>
          </div>
          <div className="flex items-center gap-2">
            {dirty ? <span className="text-[12px] font-semibold" style={{ color: "var(--gedify-orange)" }}>Modifications non enregistrées</span> : msg ? <span className="text-[12px] font-semibold" style={{ color: "var(--gedify-green)" }}>{msg}</span> : null}
            <button type="button" onClick={save} disabled={!dirty || saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2} />} Enregistrer les paramètres
            </button>
          </div>
        </div>
        {/* Menu d'ancres léger (toutes résolutions) */}
        <nav className="mx-auto mt-2 flex max-w-3xl flex-wrap gap-1.5" aria-label="Sections des paramètres">
          {SECTIONS.map((s) => {
            const on = active === s.id;
            const Icon = s.icon;
            return (
              <a key={s.id} href={`#${s.id}`} onClick={(e) => goToSection(e, s.id)} aria-current={on ? "true" : undefined}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition"
                style={{ borderColor: on ? "var(--accent)" : "var(--border)", background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--text-muted)" }}>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {s.label}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 p-5">
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Réglages du moteur documentaire et informations système.</p>

        {/* GED & documents — seul bloc réellement paramétrable */}
        <Section id="ged-documents" icon={FileText} tone="green" title="GED & documents">
          <ToggleLine
            label="Analyse IA automatique à l'import"
            desc="Analyse les documents dès l'import (l'analyse manuelle reste possible)."
            checked={flags.autoAiAnalysisEnabled}
            onChange={(v) => setFlags((f) => ({ ...f, autoAiAnalysisEnabled: v }))}
          />
          <Status label="OCR & indexation" value="Automatiques" tone="green" />
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-hint)" }}>L&apos;OCR et l&apos;indexation s&apos;exécutent automatiquement en arrière-plan après chaque import.</p>
        </Section>

        {/* À propos de Gedify */}
        <Section id="a-propos" icon={Info} tone="blue" title="À propos de Gedify">
          <div className="grid gap-2 sm:grid-cols-2">
            <Status label="Version Gedify" value={engine.version ?? "—"} />
            <Status label="Version API" value={engine.apiVersion ?? "—"} />
            <Status label="Moteur" value={engine.connected ? "Connecté" : "Erreur"} tone={engine.connected ? "green" : "orange"} />
            <Status label="État de connexion" value={engine.connected ? "Opérationnel" : (engine.error ?? "Indisponible")} tone={engine.connected ? "green" : "orange"} />
          </div>
        </Section>
      </div>

      {/* Barre d'action inférieure : affichée uniquement s'il y a des modifications. */}
      {dirty ? (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg-page) 92%, transparent)", backdropFilter: "blur(6px)" }}>
          <button type="button" onClick={cancel} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)] disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            <RotateCcw className="h-4 w-4" strokeWidth={1.85} /> Annuler les modifications
          </button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2} />} Enregistrer les paramètres
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ── Sous-composants ── */
const TONE_BG: Record<SectionTone, string> = { green: "var(--gedify-green-soft)", blue: "var(--gedify-info-soft)" };
const TONE_FG: Record<SectionTone, string> = { green: "var(--gedify-green)", blue: "var(--gedify-info)" };

function Section({ id, icon: Icon, tone, title, children }: { id: string; icon: React.ElementType; tone: SectionTone; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border bg-white" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}>
      <div className="flex items-center gap-2.5 border-b px-3 py-2.5" style={{ borderColor: "var(--border-soft)" }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: TONE_BG[tone], color: TONE_FG[tone] }}>
          <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
        </span>
        <h2 className="text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>{title}</h2>
      </div>
      <div className="space-y-1.5 px-3 py-3">{children}</div>
    </section>
  );
}

function Status({ label, value, tone }: { label: string; value: string; tone?: "green" | "orange" | "muted" }) {
  const color = tone === "green" ? "var(--gedify-green)" : tone === "orange" ? "var(--gedify-orange)" : "var(--text-main)";
  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

function ToggleLine({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{label}</p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{desc}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full transition" style={{ background: checked ? "var(--accent)" : "var(--border-strong)" }}>
        <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: checked ? "18px" : "2px" }} />
      </button>
    </div>
  );
}
