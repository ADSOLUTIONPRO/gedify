"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive, Calendar, FileSignature, FileText, HardDrive, Info, ListPlus, Loader2,
  Mail, Palette, RotateCcw, Save, ScrollText, ShieldCheck, SlidersHorizontal, Users,
  Wallet, Workflow,
} from "lucide-react";

/* ── Page unique Administration › Paramètres (charte GEDify, fond beige token). ── */

export type AdminSettingsProps = {
  account: { email: string | null; mfa: boolean };
  engine: { connected: boolean; version: string | null; apiVersion: string | null; error: string | null };
  storageUsedPercent: number | null;
  initialFlags: { financeSpaceEnabled: boolean; autoBudgetClassificationEnabled: boolean };
  counts: { gmailAccounts: number; signatures: number; customFields: number | null; workflows: number | null; hiddenSenders: number | null };
  lastBackupAt: string | null;
};

type Flags = AdminSettingsProps["initialFlags"];
type SectionTone = "blue" | "purple" | "pink" | "green" | "orange";

const SECTIONS: { id: string; label: string; icon: React.ElementType; tone: SectionTone }[] = [
  { id: "security", label: "Connexion & sécurité", icon: ShieldCheck, tone: "blue" },
  { id: "modules", label: "Modules & automatisations", icon: SlidersHorizontal, tone: "purple" },
  { id: "ui", label: "Interface utilisateur", icon: Palette, tone: "pink" },
  { id: "emails", label: "Emails & notifications", icon: Mail, tone: "blue" },
  { id: "ged", label: "GED & documents", icon: FileText, tone: "green" },
  { id: "workflows", label: "Workflows & automatisations", icon: Workflow, tone: "purple" },
  { id: "agenda", label: "Agenda & tâches", icon: Calendar, tone: "orange" },
  { id: "finances", label: "Finances", icon: Wallet, tone: "green" },
  { id: "contacts", label: "Contacts", icon: Users, tone: "blue" },
  { id: "office", label: "Office & intégrations", icon: FileSignature, tone: "purple" },
  { id: "backup", label: "Sauvegarde & migration", icon: Archive, tone: "orange" },
  { id: "storage", label: "Stockage & système", icon: HardDrive, tone: "blue" },
  { id: "fields", label: "Champs personnalisés", icon: ListPlus, tone: "pink" },
  { id: "logs", label: "Journaux & activités", icon: ScrollText, tone: "green" },
  { id: "about", label: "À propos de Gedify", icon: Info, tone: "blue" },
];

export function AdministrationSettings(props: AdminSettingsProps) {
  const { account, engine, storageUsedPercent, initialFlags, counts, lastBackupAt } = props;
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [saved, setSaved] = useState<Flags>(initialFlags);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [active, setActive] = useState("security");
  const scrollRef = useRef<HTMLDivElement>(null);

  const dirty = flags.financeSpaceEnabled !== saved.financeSpaceEnabled || flags.autoBudgetClassificationEnabled !== saved.autoBudgetClassificationEnabled;

  // Scroll-spy
  useEffect(() => {
    const root = scrollRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root, rootMargin: "-20% 0px -70% 0px", threshold: [0, 0.2, 0.5] },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

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
    <div className="grid h-[calc(100vh-53px)]" style={{ gridTemplateColumns: "245px minmax(0,1fr)", background: "var(--bg-page)" }}>
      {/* Sidebar ancres */}
      <aside className="hidden min-h-0 flex-col overflow-y-auto border-r md:flex" style={{ background: "var(--surface-muted)", borderColor: "var(--border)" }}>
        <div className="px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Administration</h2>
          <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Utilisateurs, connecteurs & sécurité</p>
        </div>
        <nav className="px-2 pb-4">
          {SECTIONS.map((s, i) => {
            const on = active === s.id;
            return (
              <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition"
                style={{ background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--text-muted)", fontWeight: on ? 700 : 500 }}>
                <span className="w-4 text-right text-[11px]" style={{ color: on ? "var(--accent)" : "var(--text-hint)" }}>{i + 1}</span>
                <span className="truncate">{s.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      {/* Contenu */}
      <div ref={scrollRef} className="min-h-0 overflow-y-auto scroll-smooth">
        {/* Save bar sticky */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ background: "color-mix(in srgb, var(--bg-page) 88%, transparent)", backdropFilter: "blur(6px)", borderColor: "var(--border)" }}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Administration · Paramètres</p>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>Paramètres</h1>
          </div>
          <div className="flex items-center gap-2">
            {dirty ? <span className="text-[12px] font-semibold" style={{ color: "var(--gedify-orange)" }}>Modifications non enregistrées</span> : msg ? <span className="text-[12px] font-semibold" style={{ color: "var(--gedify-green)" }}>{msg}</span> : null}
            <button type="button" onClick={cancel} disabled={!dirty || saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)] disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <RotateCcw className="h-4 w-4" strokeWidth={1.85} /> Annuler
            </button>
            <button type="button" onClick={save} disabled={!dirty || saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2} />} Enregistrer les paramètres
            </button>
          </div>
        </div>

        <p className="px-5 pt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>Gérez l&apos;ensemble des paramètres de Gedify depuis cette page unique.</p>

        <div className="grid gap-3 p-5 xl:grid-cols-2">
          {/* 1. Connexion & sécurité */}
          <Section id="security" icon={ShieldCheck} tone="blue" title="Connexion & sécurité">
            <Status label="Compte" value={account.email ?? "—"} />
            <Status label="Authentification (MFA)" value={account.mfa ? "Activée" : "Non activée"} tone={account.mfa ? "green" : "muted"} />
            <Status label="Moteur GEDify" value={engine.connected ? "Connecté" : "Erreur"} tone={engine.connected ? "green" : "orange"} />
            <Manage row links={[{ href: "/utilisateurs", label: "Utilisateurs" }, { href: "/groupes", label: "Groupes" }, { href: "/tokens", label: "Tokens" }, { href: "/administration/roles", label: "Rôles & permissions" }]} />
          </Section>

          {/* 2. Modules & automatisations (ÉDITABLE) */}
          <Section id="modules" icon={SlidersHorizontal} tone="purple" title="Modules & automatisations">
            <ToggleLine label="Espace Finances" desc="Affiche le module Finances" checked={flags.financeSpaceEnabled} onChange={(v) => setFlags((f) => ({ ...f, financeSpaceEnabled: v }))} />
            <ToggleLine label="Classement budgétaire automatique" desc="Classe les montants détectés au budget" checked={flags.autoBudgetClassificationEnabled} onChange={(v) => setFlags((f) => ({ ...f, autoBudgetClassificationEnabled: v }))} />
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-hint)" }}>Désactiver un module ne supprime aucune donnée.</p>
          </Section>

          {/* 3. Interface */}
          <Section id="ui" icon={Palette} tone="pink" title="Interface utilisateur">
            <ThemeControl />
            <Status label="Vue documents par défaut" value="Tableau" />
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-hint)" }}>Le thème est appliqué immédiatement (par appareil).</p>
          </Section>

          {/* 4. Emails & notifications */}
          <Section id="emails" icon={Mail} tone="blue" title="Emails & notifications">
            <Status label="Comptes connectés" value={`${counts.gmailAccounts}`} />
            <Status label="Signatures" value={`${counts.signatures}`} />
            <Status label="Expéditeurs masqués" value={counts.hiddenSenders != null ? `${counts.hiddenSenders}` : "—"} />
            <Manage row links={[{ href: "/emails", label: "Configurer les emails" }, { href: "/emails#signatures", label: "Éditer la signature" }, { href: "/parametres/notifications", label: "Notifications détaillées" }]} />
          </Section>

          {/* 5. GED & documents */}
          <Section id="ged" icon={FileText} tone="green" title="GED & documents">
            <Status label="OCR & indexation" value="Automatiques" tone="green" />
            <Status label="Analyse IA" value="À la demande / auto" />
            <Manage row links={[{ href: "/a-traiter", label: "Documents à traiter" }, { href: "/administration/doublons", label: "Doublons" }, { href: "/administration/sante", label: "Santé GED" }]} />
          </Section>

          {/* 6. Workflows */}
          <Section id="workflows" icon={Workflow} tone="purple" title="Workflows & automatisations">
            <Status label="Règles actives" value={counts.workflows != null ? `${counts.workflows}` : "—"} />
            <Manage row links={[{ href: "/workflows", label: "Gérer les règles" }, { href: "/organiser/tags", label: "Taxonomies" }]} />
          </Section>

          {/* 7. Agenda & tâches */}
          <Section id="agenda" icon={Calendar} tone="orange" title="Agenda & tâches">
            <Status label="Rappels rendez-vous" value="Activés" />
            <Status label="Tâches depuis emails" value="Détection IA" />
            <Manage row links={[{ href: "/calendrier", label: "Agenda" }, { href: "/rappels", label: "Mes tâches" }]} />
          </Section>

          {/* 8. Finances */}
          <Section id="finances" icon={Wallet} tone="green" title="Finances">
            <Status label="Espace Finances" value={flags.financeSpaceEnabled ? "Activé" : "Désactivé"} tone={flags.financeSpaceEnabled ? "green" : "muted"} />
            <Status label="Classement auto" value={flags.autoBudgetClassificationEnabled ? "Activé" : "Désactivé"} tone={flags.autoBudgetClassificationEnabled ? "green" : "muted"} />
            <Manage row links={[{ href: "/finances", label: "Ouvrir Finances" }]} />
          </Section>

          {/* 9. Contacts */}
          <Section id="contacts" icon={Users} tone="blue" title="Contacts">
            <Status label="Règle d'affichage" value="Liés à une PJ importée en GED" />
            <Status label="Synchronisation" value="Google / IMAP" />
            <Manage row links={[{ href: "/messagerie/contacts", label: "Gérer les contacts" }]} />
          </Section>

          {/* 10. Office */}
          <Section id="office" icon={FileSignature} tone="purple" title="Office & intégrations">
            <Status label="ONLYOFFICE" value="Selon configuration serveur" />
            <Manage row links={[{ href: "/redaction", label: "Office" }, { href: "/emails", label: "Connecteurs" }]} />
          </Section>

          {/* 11. Sauvegarde */}
          <Section id="backup" icon={Archive} tone="orange" title="Sauvegarde & migration">
            <Status label="Dernière sauvegarde" value={lastBackupAt ? new Date(lastBackupAt).toLocaleString("fr-FR") : "—"} />
            <Manage row links={[{ href: "/administration/sauvegarde", label: "Lancer une sauvegarde" }]} />
          </Section>

          {/* 12. Stockage & système */}
          <Section id="storage" icon={HardDrive} tone="blue" title="Stockage & système">
            <Status label="Espace utilisé" value={storageUsedPercent != null ? `${storageUsedPercent}%` : "—"} />
            <Status label="Santé système" value={engine.connected ? "OK" : "À vérifier"} tone={engine.connected ? "green" : "orange"} />
            <Manage row links={[{ href: "/stockage", label: "Stockage" }, { href: "/statut", label: "Santé système" }]} />
          </Section>

          {/* 13. Champs personnalisés */}
          <Section id="fields" icon={ListPlus} tone="pink" title="Champs personnalisés">
            <Status label="Champs créés" value={counts.customFields != null ? `${counts.customFields}` : "—"} />
            <Manage row links={[{ href: "/champs-personnalises", label: "Gérer les champs" }]} />
          </Section>

          {/* 14. Journaux */}
          <Section id="logs" icon={ScrollText} tone="green" title="Journaux & activités">
            <Status label="Journalisation" value="Activée" />
            <Manage row links={[{ href: "/journaux", label: "Voir les journaux" }]} />
          </Section>

          {/* 15. À propos */}
          <Section id="about" icon={Info} tone="blue" title="À propos de Gedify" full>
            <div className="grid gap-2 sm:grid-cols-3">
              <Status label="Version Gedify" value={engine.version ?? "—"} />
              <Status label="Version API" value={engine.apiVersion ?? "—"} />
              <Status label="Moteur" value={engine.connected ? "Connecté" : "—"} />
            </div>
          </Section>
        </div>

        {/* Rappel bas de page */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <button type="button" onClick={cancel} disabled={!dirty || saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)] disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Annuler les modifications</button>
          <button type="button" onClick={save} disabled={!dirty || saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2} />} Enregistrer les paramètres
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sous-composants ── */
const TONE_BG: Record<SectionTone, string> = { blue: "var(--gedify-info-soft)", purple: "var(--gedify-purple-soft)", pink: "var(--accent-soft)", green: "var(--gedify-green-soft)", orange: "var(--gedify-orange-soft)" };
const TONE_FG: Record<SectionTone, string> = { blue: "var(--gedify-info)", purple: "var(--gedify-purple)", pink: "var(--accent)", green: "var(--gedify-green)", orange: "var(--gedify-orange)" };

function Section({ id, icon: Icon, tone, title, children, full }: { id: string; icon: React.ElementType; tone: SectionTone; title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-20 rounded-2xl border bg-white ${full ? "xl:col-span-2" : ""}`} style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}>
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

function Manage({ links }: { links: { href: string; label: string }[]; row?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1.5">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="inline-flex h-7 items-center rounded-lg border bg-white px-2.5 text-[11.5px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function ThemeControl() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);
  function apply(t: "light" | "dark") {
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    try { localStorage.setItem("gedify-theme", t); } catch { /* ignore */ }
  }
  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <span style={{ color: "var(--text-muted)" }}>Thème</span>
      <div className="inline-flex overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
        {(["light", "dark"] as const).map((t) => (
          <button key={t} type="button" onClick={() => apply(t)} className="px-2.5 py-1 text-[12px] font-semibold transition"
            style={{ background: theme === t ? "var(--accent-soft)" : "transparent", color: theme === t ? "var(--accent)" : "var(--text-muted)" }}>
            {t === "light" ? "Clair" : "Sombre"}
          </button>
        ))}
      </div>
    </div>
  );
}
