/* Configuration centralisée des offres SaaS (Phase 7).

   Pas de "server-only" : ce module est de la donnée pure (constantes) et peut
   être importé côté serveur ET pour affichage. Aucune dépendance runtime.

   `null` sur une limite numérique = ILLIMITÉ. */

export type PlanId = "free" | "test" | "pro" | "business" | "internal";

export type PlanDefinition = {
  id: PlanId;
  label: string;
  description: string;
  supportLevel: "community" | "standard" | "priority" | "internal";
  maxUsers: number | null;
  maxDocuments: number | null;
  maxStorageMb: number | null;
  aiEnabled: boolean;
  ocrEnabled: boolean;
  emailImportEnabled: boolean;
  onlyofficeEnabled: boolean;
};

export const PLAN_IDS: PlanId[] = ["free", "test", "pro", "business", "internal"];

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    label: "Free",
    description: "Découverte — 1 utilisateur, fonctions essentielles.",
    supportLevel: "community",
    maxUsers: 1,
    maxDocuments: 50,
    maxStorageMb: 250,
    aiEnabled: false,
    ocrEnabled: true,
    emailImportEnabled: false,
    onlyofficeEnabled: false,
  },
  test: {
    id: "test",
    label: "Test",
    description: "Évaluation — petite équipe, IA et OnlyOffice inclus.",
    supportLevel: "community",
    maxUsers: 3,
    maxDocuments: 100,
    maxStorageMb: 500,
    aiEnabled: true,
    ocrEnabled: true,
    emailImportEnabled: false,
    onlyofficeEnabled: true,
  },
  pro: {
    id: "pro",
    label: "Pro",
    description: "Usage professionnel — import email et OnlyOffice.",
    supportLevel: "standard",
    maxUsers: 5,
    maxDocuments: 2000,
    maxStorageMb: 5000,
    aiEnabled: true,
    ocrEnabled: true,
    emailImportEnabled: true,
    onlyofficeEnabled: true,
  },
  business: {
    id: "business",
    label: "Business",
    description: "Équipes — limites élevées, toutes fonctions.",
    supportLevel: "priority",
    maxUsers: 20,
    maxDocuments: 20000,
    maxStorageMb: 50000,
    aiEnabled: true,
    ocrEnabled: true,
    emailImportEnabled: true,
    onlyofficeEnabled: true,
  },
  internal: {
    id: "internal",
    label: "Interne",
    description: "Usage interne — illimité, toutes fonctions.",
    supportLevel: "internal",
    maxUsers: null,
    maxDocuments: null,
    maxStorageMb: null,
    aiEnabled: true,
    ocrEnabled: true,
    emailImportEnabled: true,
    onlyofficeEnabled: true,
  },
};

/** Plan par id, avec repli sur `free` si inconnu. */
export function getPlan(planId: string | null | undefined): PlanDefinition {
  const key = (planId ?? "").trim().toLowerCase() as PlanId;
  return PLANS[key] ?? PLANS.free;
}
