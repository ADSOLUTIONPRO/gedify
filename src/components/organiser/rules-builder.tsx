"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Workflow, Zap } from "lucide-react";

export type ExistingRule = {
  id: string;
  name: string;
  href: string;
  enabled: boolean;
};

type RulesBuilderProps = {
  existing: ExistingRule[];
  workflowsHref: string;
};

const CONDITION_FIELDS = [
  "Correspondant",
  "Type",
  "Tag",
  "Titre",
  "Contenu OCR",
  "Email source",
  "Montant",
  "Date",
  "Dossier / Projet",
  "Confiance IA",
];

const ACTIONS = [
  "Appliquer un type",
  "Appliquer un tag",
  "Définir le correspondant",
  "Lier à un dossier / projet",
  "Créer une action",
  "Créer un rappel",
  "Créer une ligne budget à contrôler",
];

/**
 * Constructeur visuel de règles « SI [condition] ALORS [action] ».
 *
 * L'aperçu est construit côté client ; l'enregistrement de règles propres à la
 * surcouche n'est pas encore branché — l'automatisation réelle passe par les
 * workflows Gedify (lien ci-dessous). Aucune exécution automatique ici.
 */
export function RulesBuilder({ existing, workflowsHref }: RulesBuilderProps) {
  const [field, setField] = useState(CONDITION_FIELDS[0]);
  const [value, setValue] = useState("");
  const [action, setAction] = useState(ACTIONS[0]);

  return (
    <div className="space-y-5">
      {/* Constructeur */}
      <section className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
          Nouvelle règle
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="rounded-md px-2 py-1 font-bold" style={{ background: "rgba(11,92,255,0.08)", color: "var(--blue-600)" }}>
            SI
          </span>
          <select value={field} onChange={(e) => setField(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-[13px] font-medium outline-none" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            {CONDITION_FIELDS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="contient…"
            className="h-9 w-40 rounded-lg border bg-white px-2.5 text-[13px] font-medium outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          />
          <span className="rounded-md px-2 py-1 font-bold" style={{ background: "rgba(249,115,22,0.10)", color: "#C2410C" }}>
            ALORS
          </span>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-[13px] font-medium outline-none" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            {ACTIONS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>

        <p className="mt-3 rounded-lg border px-3 py-2 text-[12.5px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Aperçu : <span className="font-semibold" style={{ color: "var(--text-main)" }}>SI {field} {value ? `« ${value} »` : "…"} ALORS {action}</span>
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled
            title="L'enregistrement de règles propres arrivera prochainement"
            className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white opacity-50"
            style={{ background: "var(--blue-600)" }}
          >
            <Zap className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Enregistrer (bientôt)
          </button>
          <Link href={workflowsHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            <Workflow className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Workflows Gedify
          </Link>
        </div>
      </section>

      {/* Règles existantes */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
          Règles existantes
        </p>
        {existing.length === 0 ? (
          <div className="rounded-2xl border bg-white px-6 py-10 text-center" style={{ borderColor: "var(--border)" }}>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              Aucune règle automatique pour l&apos;instant. Créez des workflows dans la GED pour automatiser le classement.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {existing.map((rule) => (
              <Link
                key={rule.id}
                href={rule.href}
                className="group flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition hover:-translate-y-0.5"
                style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
              >
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(11,92,255,0.08)", color: "var(--blue-600)" }}>
                  <Workflow className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>
                  {rule.name}
                </span>
                <span className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold" style={rule.enabled ? { background: "rgba(22,163,74,0.10)", color: "#15803D" } : { background: "rgba(100,116,139,0.12)", color: "#475569" }}>
                  {rule.enabled ? "Actif" : "Inactif"}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
