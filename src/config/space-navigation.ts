/**
 * Menus internes de chaque espace de travail.
 *
 * Ces entrées alimentent la `SpaceSidebar` (nav verticale sur grand écran,
 * onglets horizontaux sur tablette / mobile). Les `href` pointent vers des
 * sous-routes existantes quand elles existent ; sinon vers la route parente
 * de l'espace (non bloquant — aucun 404 forcé).
 *
 * La clé du Record correspond au `Space.id` défini dans `./spaces`.
 */

export type SpaceNavItem = {
  label: string;
  href: string;
};

export const spaceNavigation: Record<string, SpaceNavItem[]> = {
  documents: [
    { label: "Tous les documents", href: "/documents" },
    { label: "Récents", href: "/documents?tab=recents" },
    { label: "Favoris", href: "/documents?tab=favoris" },
    { label: "Partagés avec moi", href: "/documents?tab=partages" },
    { label: "À traiter", href: "/documents/a-traiter" },
    { label: "Archives", href: "/documents/archives" },
    { label: "Corbeille", href: "/corbeille" },
  ],
  ia: [
    { label: "Vue d'ensemble", href: "/ia" },
    { label: "Classement", href: "/ia/classement" },
    { label: "Documents", href: "/ia/documents" },
    { label: "Actions", href: "/ia/actions" },
    { label: "Budget", href: "/ia/budget" },
    { label: "Correspondants", href: "/ia/correspondants" },
    { label: "Prompts", href: "/ia/prompts" },
    { label: "Historique", href: "/ia/historique" },
    { label: "Erreurs", href: "/ia/erreurs" },
  ],
  finances: [
    { label: "Vue d'ensemble", href: "/finances" },
    { label: "Revenus", href: "/finances/revenus" },
    { label: "Dépenses", href: "/finances/depenses" },
    { label: "Dettes", href: "/finances/dettes" },
    { label: "Échéances", href: "/finances/echeances" },
    { label: "Prévisions", href: "/finances/previsions" },
    { label: "Documents", href: "/finances/documents" },
    { label: "Correspondants", href: "/finances/correspondants" },
    { label: "Rapports", href: "/finances/rapports" },
    { label: "Conseiller IA", href: "/finances/conseiller" },
    { label: "Comptes", href: "/finances/comptes" },
  ],
  messagerie: [
    { label: "Vue d'ensemble", href: "/messagerie" },
    { label: "Boîte de réception", href: "/messagerie/inbox" },
    { label: "Avec pièces jointes", href: "/messagerie/pieces-jointes" },
    { label: "Liés à un dossier", href: "/messagerie/dossiers" },
    { label: "Brouillons", href: "/messagerie/brouillons" },
    { label: "Envoyés", href: "/messagerie/envoyes" },
    { label: "Archives", href: "/messagerie/archives" },
    { label: "Contacts", href: "/messagerie/contacts" },
    { label: "Paramètres", href: "/messagerie/parametres" },
  ],
  office: [
    { label: "Documents", href: "/redaction" },
    { label: "Modèles", href: "/redaction/modeles" },
    { label: "Nouveau", href: "/redaction/nouveau" },
  ],
  organiser: [
    { label: "Vue d'ensemble", href: "/organiser" },
    { label: "Types", href: "/organiser/types" },
    { label: "Tags", href: "/organiser/tags" },
    { label: "Correspondants", href: "/organiser/correspondants" },
    { label: "Dossiers / Projets", href: "/organiser/dossiers" },
    { label: "Vues sauvegardées", href: "/organiser/vues" },
    { label: "Règles", href: "/organiser/regles" },
    { label: "Nettoyage", href: "/organiser/nettoyage" },
  ],
  actions: [
    { label: "Vue d'ensemble", href: "/actions" },
    { label: "À faire", href: "/actions/a-faire" },
    { label: "En cours", href: "/actions/en-cours" },
    { label: "En attente", href: "/actions/en-attente" },
    { label: "En retard", href: "/actions/en-retard" },
    { label: "Terminées", href: "/actions/terminees" },
    { label: "Automatiques", href: "/actions/automatiques" },
  ],
  rappels: [
    { label: "Vue d'ensemble", href: "/rappels" },
    { label: "À venir", href: "/rappels/a-venir" },
    { label: "En retard", href: "/rappels/en-retard" },
    { label: "Récurrents", href: "/rappels/recurrents" },
    { label: "Historique", href: "/rappels/historique" },
  ],
  contacts: [
    { label: "Tous", href: "/correspondants" },
    { label: "Correspondants", href: "/correspondants?type=correspondants" },
    { label: "Clients", href: "/correspondants?type=clients" },
    { label: "Fournisseurs", href: "/correspondants?type=fournisseurs" },
  ],
  calendrier: [
    { label: "Agenda", href: "/calendrier" },
    { label: "Rendez-vous détectés", href: "/calendrier?vue=rendez-vous" },
    { label: "Échéances à valider", href: "/calendrier?vue=echeances" },
    { label: "Synchronisation", href: "/calendrier?vue=synchronisation" },
  ],
  administration: [
    { label: "Utilisateurs", href: "/utilisateurs" },
    { label: "Groupes", href: "/groupes" },
    { label: "Connecteurs", href: "/emails" },
    { label: "Journaux", href: "/journaux" },
    { label: "Paramètres", href: "/parametres" },
    { label: "Statut système", href: "/statut" },
  ],
};

export function getSpaceNav(spaceId: string): SpaceNavItem[] {
  return spaceNavigation[spaceId] ?? [];
}
