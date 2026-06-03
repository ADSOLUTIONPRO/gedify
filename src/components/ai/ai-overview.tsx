import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  FileSearch,
  Sparkles,
  Users,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AiBatchActions } from "@/components/ai/ai-batch-actions";
import { AIConfidenceBadge } from "@/components/ai/ai-confidence-badge";
import type { AIConfidence } from "@/lib/ai/types";

export type AiOverviewCounts = {
  toValidate: number;
  applied: number;
  errors: number;
  financial: number;
  correspondents: number;
  actions: number;
};

export type RecentAnalysisVM = {
  id: string;
  title: string;
  statusLabel: string;
  confidence: AIConfidence;
  href: string;
};

type AiOverviewProps = {
  counts: AiOverviewCounts;
  pendingCount: number;
  recent: RecentAnalysisVM[];
  providerLabel: string;
  providerIsMock: boolean;
};

type CardDef = { key: keyof AiOverviewCounts; label: string; desc: string; color: string; icon: LucideIcon; href: string };

const CARDS: CardDef[] = [
  { key: "toValidate", label: "À valider", desc: "Analyses prêtes à contrôler", color: "#7C3AED", icon: Sparkles, href: "/ia/classement" },
  { key: "applied", label: "Analyses appliquées", desc: "Validées et appliquées", color: "#16A34A", icon: CheckCircle2, href: "/ia/historique" },
  { key: "errors", label: "Erreurs", desc: "Analyses en échec contrôlé", color: "#EF4444", icon: XCircle, href: "/ia/erreurs" },
  { key: "financial", label: "Documents financiers", desc: "Impacts budget détectés", color: "#16A34A", icon: Coins, href: "/ia/budget" },
  { key: "correspondents", label: "Correspondants proposés", desc: "À confirmer ou créer", color: "#0B5CFF", icon: Users, href: "/ia/correspondants" },
  { key: "actions", label: "Actions recommandées", desc: "À valider dans Actions", color: "#F97316", icon: Zap, href: "/ia/actions" },
];

/** Vue d'ensemble de l'espace Analyse IA : cartes, file à analyser, dernières analyses. */
export function AiOverview({ counts, pendingCount, recent, providerLabel, providerIsMock }: AiOverviewProps) {
  return (
    <div className="space-y-5">
      {/* Provider */}
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px]"
        style={{ borderColor: "var(--border)", background: providerIsMock ? "rgba(245,158,11,0.06)" : "rgba(124,58,237,0.05)" }}
      >
        <Sparkles className="h-4 w-4" style={{ color: "var(--violet)" }} strokeWidth={1.75} aria-hidden="true" />
        <span style={{ color: "var(--text-muted)" }}>
          Provider IA : <strong style={{ color: "var(--text-main)" }}>{providerLabel}</strong>
          {providerIsMock ? " (règles locales — analyses simulées)" : ""}. Toutes les analyses passent côté serveur.
        </span>
      </div>

      {/* Cartes */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.key}
              href={c.href}
              className="group flex flex-col rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5"
              style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
            >
              <div className="flex items-center justify-between">
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${c.color}14`, color: c.color }}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
                  {counts[c.key]}
                </span>
              </div>
              <span className="mt-2 text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>{c.label}</span>
              <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>{c.desc}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Documents à analyser */}
        <section className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
            <FileSearch className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Documents à analyser
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
            {pendingCount}
          </p>
          <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            documents récents sans analyse IA.
          </p>
          <div className="mt-3">
            <AiBatchActions pendingCount={pendingCount} />
          </div>
        </section>

        {/* Dernières analyses */}
        <section className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Dernières analyses
          </p>
          {recent.length === 0 ? (
            <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Aucune analyse récente.
            </p>
          ) : (
            <ul className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
              {recent.map((r) => (
                <li key={r.id} style={{ borderColor: "var(--border)" }}>
                  <Link href={r.href} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 transition hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{r.title}</span>
                      <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>{r.statusLabel}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <AIConfidenceBadge confidence={r.confidence} />
                      <ArrowRight className="h-4 w-4 text-slate-300" strokeWidth={2} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* lien Warnings/erreurs */}
      {counts.errors > 0 ? (
        <Link href="/ia/erreurs" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--danger)" }}>
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {counts.errors} analyse(s) en erreur à contrôler
        </Link>
      ) : null}
    </div>
  );
}
