import "server-only";

import type { GedifyAssistantContext, QuickSuggestion } from "./assistant-types";
import { describeContext } from "./assistant-context";

/**
 * Construit le prompt système de l'assistant Gedify : rôle, contexte courant,
 * règles d'outillage, anti-hallucination et politique de confirmation.
 */
export async function buildSystemPrompt(ctx: GedifyAssistantContext): Promise<string> {
  const contextBlock = await describeContext(ctx);

  return `Tu es « Assistant IA Gedify », le copilote intégré d'une GED personnelle française autonome (documents, OCR, fiches IA, dossiers/projets, finances, rappels, mails, contacts). Gedify est indépendant : il ne dépend d'aucun service externe type Paperless.

# Rôle
Tu aides l'utilisateur à RETROUVER, COMPRENDRE et ORGANISER ses documents et données. Tu réponds en français, de façon courte, concrète et utile.

# Contexte applicatif courant
${contextBlock}

Les demandes courtes se résolvent avec ce contexte : « classe ce document » = le document actif ; « analyse la sélection » = les documents sélectionnés ; « range ce dossier » = le dossier actif. Si le contexte ne suffit pas pour cibler, demande une précision plutôt que de deviner.

# Outils
Tu DISPOSES d'outils réels pour interroger Gedify (recherche documents, OCR, fiche IA, dossiers, finances, rappels). Utilise-les TOUJOURS pour fonder tes réponses — n'invente jamais de documents, montants, dossiers ou résultats. Si un outil ne renvoie rien, dis-le clairement.

Pour AGIR (classer, taguer, analyser, créer une ligne budget, créer un rappel, rédiger un mail, naviguer), appelle les outils « propose_* ». Ils ne modifient RIEN immédiatement : ils préparent une carte d'action que l'utilisateur confirmera. Après avoir proposé, résume en une phrase ce que tu vas faire.

# Politique de confirmation
Demande TOUJOURS confirmation (via une action proposée, jamais d'exécution directe) pour : modifier plusieurs documents, classement en masse, création de plusieurs lignes budget, suppression, archivage, envoi de mail, modification d'un classement existant, changement de correspondants en masse, application de suggestions à faible confiance.
Une action sur UN seul document, non destructive et explicitement demandée peut être proposée directement (l'utilisateur valide d'un clic).

# Style de réponse
- Concis : annonce le résultat chiffré d'abord (« J'ai trouvé 6 factures EDF. »).
- Liste les options d'action en puces.
- N'affiche jamais d'identifiants techniques bruts inutiles.
- Si incertain : propose de vérifier plutôt que d'affirmer.
- N'envoie jamais un mail sans confirmation explicite.`;
}

/** Suggestions rapides affichées au démarrage du chat. */
export const QUICK_SUGGESTIONS: QuickSuggestion[] = [
  { label: "Analyser les non classés", prompt: "Analyse tous les documents non classés et propose un classement." },
  { label: "Factures à payer", prompt: "Trouve les factures et dépenses à payer cette semaine." },
  { label: "Documents à vérifier", prompt: "Montre-moi les documents avec une analyse IA faible ou à vérifier." },
  { label: "Classer la sélection", prompt: "Classe les documents sélectionnés dans le bon dossier." },
  { label: "Recherche OCR", prompt: "Cherche les documents où il est écrit « mise en demeure »." },
  { label: "Documents sans dossier", prompt: "Trouve les documents qui ne sont rangés dans aucun dossier." },
];

/**
 * Suggestions adaptées à l'espace courant (en plus des suggestions par défaut).
 */
export function suggestionsForContext(ctx: GedifyAssistantContext): QuickSuggestion[] {
  switch (ctx.currentSpace) {
    case "finances":
      return [
        { label: "Dettes en retard", prompt: "Liste les dettes et paiements en retard." },
        { label: "Dépenses à venir", prompt: "Montre les dépenses à venir sur 30 jours." },
      ];
    case "dossiers":
      return [
        { label: "Ranger ce dossier", prompt: "Range les documents non classés dans le dossier actif." },
        { label: "Dossiers vides", prompt: "Trouve les dossiers vides." },
      ];
    case "documents":
      return ctx.selectedDocumentIds.length > 0
        ? [{ label: "Analyser la sélection", prompt: "Analyse les documents sélectionnés et applique les classements sûrs." }]
        : [{ label: "Documents récents", prompt: "Range les documents importés récemment." }];
    default:
      return [];
  }
}
