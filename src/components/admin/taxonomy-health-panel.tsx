"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw, Tags, Wrench } from "lucide-react";

type Health = {
  counts: { tags: number; correspondents: number; documentTypes: number };
  orphans: { tags: string[]; correspondents: string[]; documentTypes: string[] };
  orphanCount: number;
  validatedAnalyses: number;
};

type RepairReport = {
  tagsCreated: string[];
  typesCreated: string[];
  correspondentsCreated: string[];
  relationsRepaired: number;
  valuesIgnored: number;
  errors: string[];
};

/**
 * Diagnostic des taxonomies (tags / types / correspondants) + réparation des
 * valeurs validées orphelines (recrée les entités manquantes et reconnecte les
 * documents). Source unique : routes du moteur.
 */
export function TaxonomyHealthPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [report, setReport] = useState<RepairReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/taxonomies", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealth((await res.json()) as Health);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnostic indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function repair() {
    setRepairing(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/admin/taxonomies", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; report?: RepairReport; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setReport(data.report ?? null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réparation impossible.");
    } finally {
      setRepairing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          Vérifie que toute valeur créée/validée depuis la Fiche Doc existe comme entité réelle et reste proposée partout.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12px] font-semibold transition hover:bg-slate-50 disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" />}
          Vérifier l&apos;intégrité
        </button>
      </div>

      {health ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={Tags} label="Tags" value={health.counts.tags} />
            <Stat icon={Tags} label="Types" value={health.counts.documentTypes} />
            <Stat icon={Tags} label="Correspondants" value={health.counts.correspondents} />
          </div>

          {health.orphanCount === 0 ? (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--gedify-green-soft)", color: "var(--text-main)" }}>
              <CheckCircle2 className="h-4 w-4" style={{ color: "var(--gedify-green)" }} strokeWidth={2} aria-hidden="true" />
              Aucune valeur orpheline — {health.validatedAnalyses} analyse(s) validée(s) vérifiée(s).
            </div>
          ) : (
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--gedify-orange)", background: "var(--gedify-orange-soft)" }}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--gedify-orange)" }} strokeWidth={2} aria-hidden="true" />
                <p className="text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>
                  {health.orphanCount} valeur(s) validée(s) sans entité réelle
                </p>
              </div>
              <OrphanList label="Tags" items={health.orphans.tags} />
              <OrphanList label="Types" items={health.orphans.documentTypes} />
              <OrphanList label="Correspondants" items={health.orphans.correspondents} />
              <button
                type="button"
                onClick={() => void repair()}
                disabled={repairing}
                className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {repairing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wrench className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />}
                Réparer les taxonomies orphelines
              </button>
            </div>
          )}
        </>
      ) : null}

      {report ? (
        <div className="rounded-xl border p-3 text-[12px]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <p className="font-bold">Rapport de réparation</p>
          <ul className="mt-1 space-y-0.5" style={{ color: "var(--text-muted)" }}>
            <li>Tags recréés : {report.tagsCreated.length}{report.tagsCreated.length ? ` (${report.tagsCreated.join(", ")})` : ""}</li>
            <li>Types recréés : {report.typesCreated.length}{report.typesCreated.length ? ` (${report.typesCreated.join(", ")})` : ""}</li>
            <li>Correspondants recréés : {report.correspondentsCreated.length}{report.correspondentsCreated.length ? ` (${report.correspondentsCreated.join(", ")})` : ""}</li>
            <li>Relations réparées : {report.relationsRepaired}</li>
            <li>Valeurs ignorées : {report.valuesIgnored}</li>
            {report.errors.length ? <li style={{ color: "var(--danger)" }}>Erreurs : {report.errors.length}</li> : null}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--gedify-orange-soft)", color: "var(--text-main)" }}>{error}</p>
      ) : null}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>
        <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" /> {label}
      </div>
      <p className="mt-0.5 text-[18px] font-extrabold" style={{ color: "var(--text-main)" }}>{value}</p>
    </div>
  );
}

function OrphanList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-main)" }}>
      <span className="font-bold">{label} :</span> {items.join(", ")}
    </p>
  );
}
