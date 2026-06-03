/**
 * Règles de détection des actions recommandées injectées dans le prompt.
 *
 * Toute action proposée suppose une validation humaine avant exécution.
 */
export const ACTION_DETECTION_RULES = `
Règles strictes de détection des actions recommandées.

- Ne proposer une action que si le document la justifie explicitement
  (échéance de paiement, demande de réponse, relance, document à signer…).
- Chaque action a un type parmi : pay (payer), reply (répondre),
  follow-up (relancer), verify (vérifier), classify (classer), sign (signer),
  send (envoyer), call (contacter), prepare (préparer un courrier),
  declare (déclarer), contest (contester), archive, keep.
- Renseigner dueDate uniquement si une date limite est explicite.
- Renseigner amount uniquement si un montant est lié à l'action.
- Fixer la priorité (low / normal / high / urgent) selon l'urgence réelle
  (mise en demeure, dernier rappel = urgent ; information = low).
- Ne jamais inventer une action sans fondement dans le texte.

Toutes les actions proposées apparaîtront dans l'espace Actions en statut
"À valider" : l'utilisateur décide toujours de leur exécution.
`;
