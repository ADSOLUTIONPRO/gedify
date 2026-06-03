import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarRange,
  FileText,
  FileType2,
  FolderTree,
  Mail,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

/**
 * Configuration centralisée des « espaces de travail » de GED AzServer.
 *
 * Un espace = une zone de travail principale, exposée :
 * - comme nœud de la carte radiale sur la page d'accueil ;
 * - comme cible de navigation depuis la sidebar globale / le panneau détail.
 *
 * IMPORTANT : cette config est 100 % statique (pas d'appel réseau, aucun
 * secret Paperless/OpenAI/Google). Les `stats` sont des libellés indicatifs ;
 * elles pourront être branchées plus tard sur des données serveur.
 */

export type SpaceStat = {
  label: string;
  value: string | number;
};

export type SpaceQuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type Space = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Icône image premium (style Google Workspace) servie depuis
   * `/public/iconesmenu`. Prioritaire sur `icon` (Lucide) là où elle est gérée
   * (menu Applications). Absente → fallback sur l'icône Lucide.
   */
  image?: string;
  /** Couleur de domaine (hex), utilisée pour les icônes et accents. */
  color: string;
  /** Phrase complète affichée dans le panneau détail. */
  description: string;
  /** Une ligne, affichée sur la carte d'espace. */
  shortDescription: string;
  stats?: SpaceStat[];
  quickActions?: SpaceQuickAction[];
};

export const spaces: Space[] = [
  {
    id: "documents",
    label: "Documents",
    href: "/documents",
    icon: FileText,
    image: "/iconesmenu/documents.png",
    color: "#B0894F",
    description:
      "Consultez, filtrez et organisez l'ensemble de vos documents indexés dans la GED.",
    shortDescription: "Tous vos documents indexés",
    quickActions: [
      { label: "Tous les documents", href: "/documents", icon: FileText },
      { label: "Types", href: "/types", icon: FileType2 },
      { label: "Tags", href: "/tags", icon: FolderTree },
    ],
  },
  {
    id: "ia",
    label: "Analyse IA",
    href: "/ia",
    icon: Sparkles,
    image: "/iconesmenu/IA.png",
    color: "#6E6780",
    description:
      "Validez les classements suggérés, les métadonnées extraites et les actions recommandées par l'IA.",
    shortDescription: "Classement et extraction assistés",
    quickActions: [
      { label: "File d'analyse", href: "/ia", icon: Sparkles },
      { label: "Classement IA", href: "/ia/classement", icon: FolderTree },
    ],
  },
  {
    id: "finances",
    label: "Finances",
    href: "/finances",
    icon: PiggyBank,
    image: "/iconesmenu/Budgets.png",
    color: "#B8924E",
    description:
      "Suivez revenus, dépenses, dettes et échéances reconstitués à partir de vos documents.",
    shortDescription: "Budget, revenus & échéances",
    quickActions: [
      { label: "Vue d'ensemble", href: "/finances", icon: PiggyBank },
      { label: "Dépenses", href: "/finances/depenses", icon: FileText },
    ],
  },
  {
    id: "messagerie",
    label: "Messagerie",
    href: "/messagerie",
    icon: Mail,
    image: "/iconesmenu/GEDmail.png",
    color: "#F75C8D",
    description:
      "Gérez emails, contacts et pièces jointes professionnelles, reliés à vos dossiers.",
    shortDescription: "Emails & pièces jointes",
    quickActions: [
      { label: "Boîte de réception", href: "/messagerie", icon: Mail },
      { label: "Contacts", href: "/messagerie/contacts", icon: Users },
    ],
  },
  {
    id: "office",
    label: "Office",
    href: "/office",
    icon: FileType2,
    image: "/iconesmenu/office.png",
    color: "#6E6FA0",
    description:
      "Rédigez, mettez en forme et exportez des documents à partir de modèles et de signatures.",
    shortDescription: "Rédaction & modèles",
    quickActions: [
      { label: "Rédaction", href: "/redaction", icon: FileType2 },
      { label: "Modèles", href: "/redaction/modeles", icon: FileText },
    ],
  },
  {
    id: "organiser",
    label: "Organiser",
    href: "/organiser",
    icon: FolderTree,
    image: "/iconesmenu/dossiers-projets.png",
    color: "#B68A4A",
    description:
      "Structurez vos dossiers, projets, types et taxonomies pour un classement cohérent.",
    shortDescription: "Dossiers, projets & taxonomies",
    quickActions: [
      { label: "Dossiers / Projets", href: "/dossiers", icon: FolderTree },
      { label: "Types de documents", href: "/types", icon: FileType2 },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    href: "/actions",
    icon: Zap,
    image: "/iconesmenu/actions.png",
    color: "#C07A4A",
    description:
      "Suivez et pilotez vos actions et tâches liées aux documents et aux dossiers.",
    shortDescription: "Tâches & suivi",
    quickActions: [
      { label: "À faire", href: "/actions/a-faire", icon: Zap },
      { label: "Terminées", href: "/actions/terminees", icon: FileText },
    ],
  },
  {
    id: "rappels",
    label: "Rappels",
    href: "/rappels",
    icon: Bell,
    image: "/iconesmenu/rappels.png",
    color: "#D06A85",
    description:
      "Suivez les échéances, rappels récurrents et alertes liées à vos documents et dossiers.",
    shortDescription: "Échéances & alertes",
    quickActions: [
      { label: "Actions & rappels", href: "/actions", icon: Bell },
      { label: "Calendrier", href: "/calendrier", icon: CalendarRange },
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    href: "/correspondants",
    icon: Users,
    image: "/iconesmenu/contacts.png",
    color: "#BE8266",
    description:
      "Gérez correspondants, clients et fournisseurs, reliés à vos documents et échanges.",
    shortDescription: "Correspondants & clients",
    quickActions: [
      { label: "Correspondants", href: "/correspondants", icon: Users },
    ],
  },
  {
    id: "calendrier",
    label: "Calendrier",
    href: "/calendrier",
    icon: CalendarRange,
    image: "/iconesmenu/calendrier.png",
    color: "#7D8BA6",
    description:
      "Visualisez rendez-vous détectés, échéances à valider et synchronisations d'agenda.",
    shortDescription: "Agenda & échéances",
    quickActions: [
      { label: "Agenda", href: "/calendrier", icon: CalendarRange },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    href: "/administration",
    icon: ShieldCheck,
    image: "/iconesmenu/administration.png",
    color: "#7E8A9C",
    description:
      "Gérez utilisateurs, groupes, connecteurs, sécurité et paramètres de votre environnement.",
    shortDescription: "Utilisateurs, connecteurs & sécurité",
    quickActions: [
      { label: "Utilisateurs", href: "/utilisateurs", icon: Users },
      { label: "Connecteurs", href: "/emails", icon: Mail },
    ],
  },
];

const spacesById = new Map(spaces.map((space) => [space.id, space]));

export function getSpaceById(id: string): Space | undefined {
  return spacesById.get(id);
}

/**
 * Retrouve l'espace correspondant à un pathname (match exact ou préfixe).
 * Retourne l'espace dont le `href` est le préfixe le plus long, afin que
 * `/budget/depenses` matche bien l'espace Finances (`/budget`).
 */
export function getSpaceByHref(pathname: string): Space | undefined {
  let best: Space | undefined;
  for (const space of spaces) {
    if (pathname === space.href || pathname.startsWith(`${space.href}/`)) {
      if (!best || space.href.length > best.href.length) {
        best = space;
      }
    }
  }
  return best;
}
