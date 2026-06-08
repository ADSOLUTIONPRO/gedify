import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { LearnedTemplatesManager } from "@/components/admin/learned-templates-manager";
import { LearningHistoryPanel } from "@/components/ai/learning-history-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modèles IA appris — Gedify" };

/** Modèles IA appris — rattaché à l'espace Documents (traitement documentaire). */
export default function DocumentsModelesIaPage() {
  return (
    <SpaceLayout spaceId="documents">
      <header className="mb-4">
        <h1 className="text-[20px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>Modèles IA appris</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          Gedify apprend de vos validations : chaque classement validé devient un modèle réutilisé pour reconnaître et classer automatiquement les documents similaires.
        </p>
      </header>
      <LearnedTemplatesManager />
      <div className="mt-5">
        <LearningHistoryPanel />
      </div>
    </SpaceLayout>
  );
}
