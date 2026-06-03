import "server-only";

import {
  Brain,
  CheckCircle2,
  FileText,
  FolderKanban,
  Import,
  Mail,
  PiggyBank,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import type { SetupStep } from "@/components/setup/setup-checklist";
import type { SetupStepStatus } from "@/components/setup/setup-step-card";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { getDocuments, getPaperlessStatus } from "@/lib/paperless";
import { listProjectFolders } from "@/lib/projects/project-store";

function boolStatus(value: boolean): SetupStepStatus {
  return value ? "done" : "todo";
}

export async function getSetupSteps(): Promise<SetupStep[]> {
  const [status, documents, accounts, analyses, projects, budgetItems] = await Promise.allSettled([
    getPaperlessStatus(),
    getDocuments({ page_size: 1 }),
    listAccounts(),
    listAnalyses(),
    listProjectFolders(),
    listFinancialItems({ limit: 1 }),
  ]);

  const paperlessConnected = status.status === "fulfilled" && status.value.connected;
  const hasDocuments =
    documents.status === "fulfilled" && (documents.value.count ?? documents.value.results.length) > 0;
  const hasAccounts = accounts.status === "fulfilled" && accounts.value.length > 0;
  const hasAnalyses = analyses.status === "fulfilled" && analyses.value.length > 0;
  const hasProjects = projects.status === "fulfilled" && projects.value.length > 0;
  const hasBudget = budgetItems.status === "fulfilled" && budgetItems.value.length > 0;

  return [
    {
      title: "Sécuriser l’accès",
      description: "Vérifier les variables serveur et garder les tokens hors client.",
      href: "/parametres",
      actionLabel: "Vérifier",
      status: "in-progress",
      icon: ShieldCheck,
    },
    {
      title: "Connecter Paperless",
      description: "Confirmer la connexion API avec votre instance Paperless.",
      href: "/statut",
      actionLabel: "Statut",
      status: boolStatus(paperlessConnected),
      icon: CheckCircle2,
    },
    {
      title: "Connecter les mails",
      description: "Ajouter Gmail ou IMAP, choisir les dossiers à scanner.",
      href: "/emails",
      actionLabel: "Connecter",
      status: boolStatus(hasAccounts),
      icon: Mail,
    },
    {
      title: "Importer les premiers documents",
      description: "Commencer avec 10 à 20 fichiers pour vérifier les réglages.",
      href: "/import",
      actionLabel: "Importer",
      status: hasDocuments ? "done" : "todo",
      icon: Import,
    },
    {
      title: "Analyser les documents",
      description: "Lancer l’IA document par document, sans appliquer automatiquement.",
      href: "/ia",
      actionLabel: "Analyser",
      status: hasAnalyses ? "done" : hasDocuments ? "in-progress" : "todo",
      icon: Brain,
    },
    {
      title: "Corriger les correspondants",
      description: "Valider les correspondants, types et tags sur les documents à traiter.",
      href: "/a-traiter",
      actionLabel: "Classer",
      status: hasDocuments ? "in-progress" : "todo",
      icon: FileText,
    },
    {
      title: "Créer les premiers dossiers/projets",
      description: "Regrouper les documents par affaire ou projet en cours.",
      href: "/dossiers",
      actionLabel: "Créer",
      status: boolStatus(hasProjects),
      icon: FolderKanban,
    },
    {
      title: "Valider le budget",
      description: "Contrôler les montants détectés avant de les intégrer au budget.",
      href: "/budget",
      actionLabel: "Budget",
      status: boolStatus(hasBudget),
      icon: PiggyBank,
    },
    {
      title: "Automatisations",
      description: "Ajouter des workflows seulement après quelques imports validés.",
      href: "/workflows",
      actionLabel: "Préparer",
      status: hasDocuments && hasProjects ? "in-progress" : "todo",
      icon: Workflow,
    },
  ];
}
