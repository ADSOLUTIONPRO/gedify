import { FolderKanban } from "lucide-react";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default function DossiersAIPage() {
  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/ia", label: "IA" }}
        eyebrow="Intelligence"
        title="Synthèses de dossiers"
        description="Vue d'ensemble IA d'un dossier ou projet. Fonctionnalité préparée — à connecter."
      />
      <HelpCard
        tone="amber"
        icon={FolderKanban}
        title="Synthèse multi-documents — à connecter"
        description="Le moteur de regroupement par dossier est prêt côté API (/api/ai/analyze-project) mais retourne aujourd'hui un état « à connecter ». La vraie synthèse arrivera quand le module Dossiers exposera ses documents au provider IA."
      />
    </main>
  );
}
