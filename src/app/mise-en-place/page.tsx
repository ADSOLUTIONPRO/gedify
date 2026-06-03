import Link from "next/link";
import { ArrowRight, FileText, Mail, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { SetupChecklist } from "@/components/setup/setup-checklist";
import { Button } from "@/components/ui/button";
import { CompactCard } from "@/components/ui/compact-card";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { InfoMetric } from "@/components/ui/info-metric";
import { PageShell } from "@/components/ui/page-shell";
import { getSetupSteps } from "@/lib/setup/setup-status";

export const dynamic = "force-dynamic";

export default async function MiseEnPlacePage() {
  const steps = await getSetupSteps();
  const done = steps.filter((step) => step.status === "done").length;
  const inProgress = steps.filter((step) => step.status === "in-progress").length;
  const nextStep = steps.find((step) => step.status !== "done") ?? steps[0];

  return (
    <PageShell>
      <CompactPageHeader
        eyebrow="Mode mise en place"
        title="Mise en place"
        description="Avancez étape par étape, sans surcharger la GED dès le départ."
        actions={
          <>
            <Button href={nextStep.href} variant="primary" size="md" iconRight={ArrowRight}>
              Continuer
            </Button>
            <Button href="/dashboard" variant="secondary" size="md">
              Tableau de bord
            </Button>
          </>
        }
      />

      <section className="grid gap-2.5 sm:grid-cols-3">
        <InfoMetric label="Étapes terminées" value={`${done}/${steps.length}`} icon={ShieldCheck} tone="green" />
        <InfoMetric label="En cours" value={inProgress} icon={Sparkles} tone="blue" />
        <InfoMetric label="Prochaine action" value={nextStep.title} helper={nextStep.actionLabel} icon={ArrowRight} tone="violet" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <CompactCard
          title="Checklist de démarrage"
          description="Les fonctions restent disponibles, mais l'interface privilégie les priorités."
        >
          <SetupChecklist steps={steps} />
        </CompactCard>

        <aside className="space-y-4">
          <CompactCard title="Importer sans tout mélanger">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>Commencez avec un petit lot de 10 à 20 documents.</p>
              <p>Analysez, corrigez les titres, puis validez les correspondants et les tags.</p>
              <Button href="/import" variant="primary" size="sm" icon={Upload}>
                Importer un petit lot
              </Button>
            </div>
          </CompactCard>

          <CompactCard title="Mails progressivement">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>Connectez une seule boîte, prévisualisez les imports, puis ajoutez les règles.</p>
              <p>Évitez Spam, Corbeille, Achats et Promotions au démarrage.</p>
              <Button href="/emails" variant="secondary" size="sm" icon={Mail}>
                Configurer les mails
              </Button>
            </div>
          </CompactCard>

          <CompactCard title="Contrôle quotidien">
            <div className="grid gap-2">
              <Link href="/a-traiter" className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                Documents à traiter
                <FileText className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
              </Link>
              <Link href="/ia" className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                Analyse IA
                <Sparkles className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
              </Link>
            </div>
          </CompactCard>
        </aside>
      </div>
    </PageShell>
  );
}
