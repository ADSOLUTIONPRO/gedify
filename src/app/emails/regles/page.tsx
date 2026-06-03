import {
  ArrowRight,
  CheckSquare,
  ExternalLink,
  Filter,
  Settings2,
  Zap,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { listRules } from "@/lib/mail-connector/rule-store";
import { getPaperlessPublicUrl } from "@/lib/paperless";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  "Si expéditeur contient « edf » → tag Maison + type Facture + correspondant EDF",
  "Si expéditeur contient « caf » → tag Administratif + correspondant CAF",
  "Si objet contient « facture » → type Facture",
  "Si nom de pièce jointe contient « bulletin » → type Bulletin de salaire + tag Travail",
  "Si expéditeur contient « notaire » → tag Notaire + tag Maison",
];

export default async function EmailReglesPage() {
  const [rules, accounts] = await Promise.all([listRules(), listAccounts()]);
  const paperlessUrl = getPaperlessPublicUrl();

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/emails", label: "Emails" }}
        eyebrow="Connecteurs mail"
        title="Règles email"
        description="Règles appliquées aux pièces jointes pendant la synchronisation : tag, type, correspondant…"
        actions={
          paperlessUrl ? (
            <a
              href={`${paperlessUrl}/mail_rules`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Règles natives Gedify
            </a>
          ) : null
        }
      />

      <div className="mb-6">
        <HelpCard
          tone="emerald"
          icon={Filter}
          title="Conditions → Actions"
          description="Une règle déclenche une ou plusieurs actions Gedify quand une pièce jointe correspond à toutes les conditions définies."
          examples={EXAMPLES}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="Règles définies" value={rules.length} icon={Settings2} />
        <Stat label="Règles actives" value={rules.filter((r) => r.isActive).length} icon={Zap} />
        <Stat label="Comptes liés" value={accounts.length} icon={CheckSquare} />
      </div>

      {rules.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Settings2}
            title="Aucune règle pour le moment"
            description="Créez votre première règle pour classer automatiquement vos pièces jointes par expéditeur, sujet ou nom de fichier. L'éditeur de règles arrive prochainement — pour l'instant les règles peuvent être créées via l'API."
          />
          <p className="mt-3 text-center text-xs text-slate-500">
            Endpoint :{" "}
            <code className="rounded bg-slate-100 px-1 font-mono">
              POST /api/mail-connector/rules
            </code>
          </p>
        </SectionCard>
      ) : (
        <SectionCard
          icon={Settings2}
          title="Règles configurées"
          description="Triées par priorité (du plus prioritaire au moins prioritaire)."
          bodyClassName=""
        >
          <ul className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <li key={rule.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-900">{rule.name}</p>
                      {rule.isActive ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Désactivée
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        Priorité {rule.priority}
                      </span>
                    </div>
                    {rule.description ? (
                      <p className="mt-1 text-xs text-slate-500">{rule.description}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-blue-200/60 bg-blue-50/50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                      Conditions
                    </p>
                    {rule.conditions.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-500">Aucune condition.</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1 text-xs text-slate-800">
                        {rule.conditions.map((condition, index) => (
                          <li key={index}>
                            <span className="font-semibold">{condition.field}</span>{" "}
                            <span className="text-slate-500">contient</span>{" "}
                            <span className="font-mono">{condition.value}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                      Actions
                    </p>
                    {rule.actions.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-500">Aucune action.</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1 text-xs text-slate-800">
                        {rule.actions.map((action, index) => (
                          <li key={index} className="flex items-center gap-1">
                            <ArrowRight
                              className="h-3 w-3 text-emerald-600"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            <span className="font-semibold">{action.field}</span>{" "}
                            <span className="font-mono text-slate-600">{action.value}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Settings2;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
