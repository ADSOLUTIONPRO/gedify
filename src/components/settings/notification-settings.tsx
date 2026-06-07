"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, RotateCcw, Save, Search } from "lucide-react";
import {
  NOTIFICATION_CATEGORIES,
  eventsByCategory,
  type NotifCategoryId,
  type NotifFrequency,
  type NotifSeverity,
} from "@/lib/notifications/notification-catalog";

type EventPref = { inApp: boolean; email: boolean; frequency: NotifFrequency; severityThreshold: NotifSeverity };
type General = {
  emailEnabled: boolean;
  emailAddress: string | null;
  quietHours: { enabled: boolean; start: string; end: string; days: number[]; allowCritical: boolean };
  digest: { dailyEnabled: boolean; dailyTime: string; weeklyEnabled: boolean; weeklyDay: number; weeklyTime: string };
  retentionDays: number;
};

const FREQUENCIES: { value: NotifFrequency; label: string }[] = [
  { value: "immediate", label: "Immédiat" },
  { value: "hourly", label: "Toutes les heures" },
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "digest", label: "Dans un résumé" },
  { value: "off", label: "Désactivé" },
];
const SEVERITIES: { value: NotifSeverity; label: string }[] = [
  { value: "info", label: "Information" },
  { value: "normal", label: "Normale" },
  { value: "important", label: "Importante" },
  { value: "critical", label: "Critique" },
];

export function NotificationSettings() {
  const [general, setGeneral] = useState<General | null>(null);
  const [events, setEvents] = useState<Record<string, EventPref>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [financeEnabled, setFinanceEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Set<NotifCategoryId>>(new Set(["documents", "messagerie"]));

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch("/api/notifications/preferences", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        setGeneral(d.general);
        setEvents(d.events ?? {});
        setIsAdmin(Boolean(d.isAdmin));
        setFinanceEnabled(d.financeEnabled !== false);
        if (d.general && !d.general.emailAddress && d.accountEmail) {
          setGeneral((g) => (g ? { ...g, emailAddress: d.accountEmail } : g));
        }
      })
      .catch(() => { if (!cancelled) setMsg("Chargement impossible."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(
    () => NOTIFICATION_CATEGORIES.filter((c) => (c.adminOnly ? isAdmin : true) && (c.requiresFlag === "financeSpaceEnabled" ? financeEnabled : true)),
    [isAdmin, financeEnabled],
  );

  function setEvent(type: string, patch: Partial<EventPref>) {
    setEvents((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  async function save() {
    if (!general) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...general, events }),
      });
      setMsg(res.ok ? "Préférences enregistrées." : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function reset() {
    if (!window.confirm("Réinitialiser toutes vos préférences de notification aux valeurs par défaut ?")) return;
    setSaving(true);
    try {
      await fetch("/api/notifications/preferences", { method: "DELETE", credentials: "include" });
      const d = await fetch("/api/notifications/preferences", { credentials: "include", cache: "no-store" }).then((r) => r.json());
      setGeneral(d.general);
      setEvents(d.events ?? {});
      setMsg("Réinitialisé.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  function toggleCat(id: NotifCategoryId) {
    setOpenCats((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function bulkCat(id: NotifCategoryId, on: boolean) {
    const types = eventsByCategory(id).map((e) => e.type);
    setEvents((prev) => {
      const n = { ...prev };
      for (const t of types) n[t] = { ...n[t], inApp: on };
      return n;
    });
  }

  if (loading || !general) {
    return <div className="flex items-center gap-2 p-6 text-[13px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Choisissez ce qui déclenche une notification dans GEDify et/ou par email.</p>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-[12px] font-semibold" style={{ color: "var(--gedify-green)" }}>{msg}</span> : null}
          <button type="button" onClick={reset} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)] disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            <RotateCcw className="h-4 w-4" strokeWidth={1.85} /> Réinitialiser
          </button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: "var(--accent)" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2} />} Enregistrer
          </button>
        </div>
      </div>

      {/* A. Canaux / email */}
      <Card title="Canaux & email">
        <Toggle label="Autoriser les notifications par email" checked={general.emailEnabled} onChange={(v) => setGeneral({ ...general, emailEnabled: v })} />
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Adresse email de notification</span>
            <input type="email" value={general.emailAddress ?? ""} onChange={(e) => setGeneral({ ...general, emailAddress: e.target.value || null })} placeholder="vous@exemple.com" disabled={!general.emailEnabled}
              className="h-9 rounded-lg border px-3 text-[13px] outline-none focus:border-[var(--accent)] disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }} />
          </label>
          <button type="button" disabled className="h-9 rounded-lg border px-3 text-[12.5px] font-semibold opacity-60" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }} title="Envoi email à brancher">
            Envoyer un test (bientôt)
          </button>
        </div>
      </Card>

      {/* C. Résumés */}
      <Card title="Résumés">
        <Toggle label="Résumé quotidien" checked={general.digest.dailyEnabled} onChange={(v) => setGeneral({ ...general, digest: { ...general.digest, dailyEnabled: v } })} />
        <div className="mt-2"><TimeField label="Heure du résumé quotidien" value={general.digest.dailyTime} onChange={(v) => setGeneral({ ...general, digest: { ...general.digest, dailyTime: v } })} disabled={!general.digest.dailyEnabled} /></div>
        <div className="mt-3"><Toggle label="Résumé hebdomadaire" checked={general.digest.weeklyEnabled} onChange={(v) => setGeneral({ ...general, digest: { ...general.digest, weeklyEnabled: v } })} /></div>
      </Card>

      {/* D. Horaires silencieux */}
      <Card title="Horaires silencieux">
        <Toggle label="Activer les horaires silencieux" checked={general.quietHours.enabled} onChange={(v) => setGeneral({ ...general, quietHours: { ...general.quietHours, enabled: v } })} />
        <div className="mt-2 flex flex-wrap gap-3">
          <TimeField label="Début" value={general.quietHours.start} onChange={(v) => setGeneral({ ...general, quietHours: { ...general.quietHours, start: v } })} disabled={!general.quietHours.enabled} />
          <TimeField label="Fin" value={general.quietHours.end} onChange={(v) => setGeneral({ ...general, quietHours: { ...general.quietHours, end: v } })} disabled={!general.quietHours.enabled} />
        </div>
        <div className="mt-3"><Toggle label="Toujours envoyer les notifications critiques" checked={general.quietHours.allowCritical} onChange={(v) => setGeneral({ ...general, quietHours: { ...general.quietHours, allowCritical: v } })} /></div>
      </Card>

      {/* Recherche */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un type de notification…" className="h-9 w-full rounded-xl border pl-9 pr-3 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }} />
      </div>

      {/* Réglages par espace */}
      {categories.map((cat) => {
        const kw = query.trim().toLowerCase();
        const list = eventsByCategory(cat.id).filter((e) => !kw || `${e.label} ${e.description}`.toLowerCase().includes(kw));
        if (list.length === 0) return null;
        const open = openCats.has(cat.id) || kw.length > 0;
        return (
          <div key={cat.id} className="rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <button type="button" onClick={() => toggleCat(cat.id)} className="flex items-center gap-2 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
                {open ? <ChevronDown className="h-4 w-4" strokeWidth={2.5} /> : <ChevronRight className="h-4 w-4" strokeWidth={2.5} />}
                {cat.label}
                <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-hint)" }}>{list.length}</span>
              </button>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => bulkCat(cat.id, true)} className="rounded-lg px-2 py-1 text-[11.5px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ color: "var(--accent)" }}>Tout activer</button>
                <button type="button" onClick={() => bulkCat(cat.id, false)} className="rounded-lg px-2 py-1 text-[11.5px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ color: "var(--text-muted)" }}>Tout désactiver</button>
              </div>
            </div>
            {open ? (
              <ul className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
                {list.map((ev) => {
                  const p = events[ev.type] ?? { inApp: ev.defaultInApp, email: ev.defaultEmail, frequency: "immediate" as NotifFrequency, severityThreshold: ev.defaultSeverity };
                  return (
                    <li key={ev.type} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{ev.label}</p>
                        <p className="truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{ev.description}</p>
                      </div>
                      <CheckPill label="GEDify" checked={p.inApp} onChange={(v) => setEvent(ev.type, { inApp: v })} />
                      <CheckPill label="Email" checked={p.email} onChange={(v) => setEvent(ev.type, { email: v })} />
                      <select value={p.frequency} onChange={(e) => setEvent(ev.type, { frequency: e.target.value as NotifFrequency })} className="h-8 rounded-lg border px-2 text-[12px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-main)" }} aria-label="Fréquence">
                        {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <select value={p.severityThreshold} onChange={(e) => setEvent(ev.type, { severityThreshold: e.target.value as NotifSeverity })} className="h-8 rounded-lg border px-2 text-[12px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-main)" }} aria-label="Niveau minimal">
                        {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}

      <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>
        Conservation de l&apos;historique : {general.retentionDays === 0 ? "illimitée" : `${general.retentionDays} jours`}.
      </p>
    </div>
  );
}

/* ── Sous-composants ── */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <h3 className="mb-2.5 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{title}</h3>
      {children}
    </div>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13px]" style={{ color: "var(--text-main)" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: "var(--accent)" }} />
      {label}
    </label>
  );
}
function CheckPill({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] font-semibold transition" style={{ borderColor: checked ? "var(--accent)" : "var(--border)", background: checked ? "var(--accent-soft)" : "transparent", color: checked ? "var(--accent)" : "var(--text-muted)" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded" style={{ accentColor: "var(--accent)" }} />
      {label}
    </label>
  );
}
function TimeField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-9 rounded-lg border px-2 text-[13px] outline-none focus:border-[var(--accent)] disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }} />
    </label>
  );
}
