import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownLeft,
  Brain,
  Bug,
  CalendarClock,
  CalendarRange,
  CheckSquare,
  Coins,
  DatabaseZap,
  ExternalLink,
  FileText,
  FileType2,
  FolderKanban,
  FolderTree,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Mail,
  PenLine,
  PiggyBank,
  PlugZap,
  Receipt,
  ScrollText,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  Upload,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";

/**
 * Item de navigation unifié.
 *
 * - `external = true` => le lien ouvre une URL externe (target=_blank).
 *   La cible doit alors être passée via `href` ou résolue à l'exécution
 *   (cas « Ouvrir Paperless » qui dépend de `getPaperlessPublicUrl()`).
 * - `disabled = true` => l'item est affiché grisé, jamais navigable.
 *   À utiliser pour les routes qui n'existent pas encore (badge « Bientôt »).
 * - `badgeKey` => clé utilisée par la sidebar pour récupérer un compteur
 *   dynamique injecté depuis le layout (cf. `Sidebar.badges`).
 */
export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
  badgeKey?: string;
  external?: boolean;
  disabled?: boolean;
};

export type NavigationSection = {
  section: string;
  items: NavigationItem[];
};

/**
 * Sidebar gauche : usage quotidien de la GED.
 *
 * NE DOIT PAS contenir : Activité, Journaux, Workflows, Emails, Import,
 * Utilisateurs, Groupes, Profil, Paramètres, Statut système, Tokens API,
 * Moteurs, Logs techniques. Ces items sont déplacés dans le dropdown
 * « Administration » de la topbar.
 */
export const dailySidebarNavigation: NavigationSection[] = [
  {
    section: "Navigation",
    items: [
      { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
      { label: "Mise en place", href: "/mise-en-place", icon: CheckSquare },
      { label: "Documents", href: "/documents", icon: FileText },
      { label: "Recherche avancée", href: "/recherche", icon: Search },
      { label: "À traiter", href: "/a-traiter", icon: Inbox, badgeKey: "inbox" },
      { label: "Dossiers / Projets", href: "/dossiers", icon: FolderKanban },
      { label: "Correspondants", href: "/correspondants", icon: Users },
      { label: "Types de documents", href: "/types", icon: FileType2 },
      { label: "Tags", href: "/tags", icon: Tag },
    ],
  },
  {
    section: "Travail",
    items: [
      { label: "Messagerie", href: "/messagerie", icon: Mail },
      { label: "Analyse IA", href: "/ia", icon: Sparkles },
      { label: "Classement IA", href: "/ia/classement", icon: FolderTree },
      { label: "Actions & rappels", href: "/actions", icon: Zap },
      { label: "Calendrier & rendez-vous", href: "/calendrier", icon: CalendarRange },
      { label: "Rédaction", href: "/redaction", icon: PenLine },
    ],
  },
  {
    section: "Budget & Finances",
    items: [
      { label: "Tableau budget", href: "/budget", icon: PiggyBank },
      { label: "Revenus", href: "/budget/revenus", icon: ArrowDownLeft },
      { label: "Dépenses", href: "/budget/depenses", icon: Receipt },
      { label: "Dettes & échéances", href: "/budget/dettes", icon: Coins },
      { label: "Échéances", href: "/budget/echeances", icon: CalendarClock },
      { label: "Prévisions", href: "/budget/previsions", icon: TrendingUp },
      { label: "Documents financiers", href: "/budget/documents", icon: FileText },
      { label: "Conseiller IA", href: "/budget/conseiller", icon: Sparkles },
      { label: "Rapports", href: "/budget/rapports", icon: Wallet },
    ],
  },
];

/**
 * Menu déroulant Administration (topbar).
 *
 * Une route inexistante est marquée `disabled: true` ⇒ affichée grisée avec
 * un badge « Bientôt ». Ne pas pointer vers une route 404 active.
 *
 * « Ouvrir Paperless » est un cas particulier : `href: ""` car l'URL est
 * résolue à l'exécution côté serveur via `getPaperlessPublicUrl()` et passée
 * au composant client. Si aucune URL n'est configurée, l'item est masqué.
 */
export const administrationDropdownNavigation: NavigationSection[] = [
  {
    section: "Automatisation",
    items: [
      {
        label: "Import",
        href: "/import",
        icon: Upload,
        description: "Import manuel, sources et traitements.",
      },
      {
        label: "Workflows",
        href: "/workflows",
        icon: Workflow,
        description: "Règles automatiques et scénarios.",
      },
      {
        label: "Emails & Connecteurs",
        href: "/emails",
        icon: Mail,
        description: "Gmail, IMAP, règles d'import et pièces jointes.",
      },
      {
        label: "Journaux",
        href: "/journaux",
        icon: ScrollText,
        description: "Logs fonctionnels et historiques.",
      },
      {
        label: "Activité",
        href: "/activite",
        icon: Activity,
        description: "Supervision des tâches et événements.",
      },
    ],
  },
  {
    section: "Gestion système",
    items: [
      {
        label: "Utilisateurs",
        href: "/utilisateurs",
        icon: Users,
        description: "Comptes et accès.",
      },
      {
        label: "Groupes",
        href: "/groupes",
        icon: UsersRound,
        description: "Groupes et droits.",
      },
      {
        label: "Profil",
        href: "/profil",
        icon: UserCircle,
        description: "Préférences du compte.",
      },
      {
        label: "Tokens API",
        href: "/tokens",
        icon: KeyRound,
        description: "Jetons et accès API.",
      },
      {
        label: "Paramètres",
        href: "/parametres",
        icon: Settings,
        description: "Configuration générale.",
      },
      {
        label: "Statut système",
        href: "/statut",
        icon: Server,
        description: "Santé des services.",
      },
    ],
  },
  {
    section: "Outils avancés",
    items: [
      {
        label: "Moteurs documentaires",
        href: "/administration/moteurs",
        icon: DatabaseZap,
        description: "Paperless, GED native, moteurs hybrides.",
        badge: "Bientôt",
        disabled: true,
      },
      {
        label: "IA / Prompts",
        href: "/administration/ia",
        icon: Brain,
        description: "Provider IA, prompts métier, règles de cohérence.",
        badge: "Bientôt",
        disabled: true,
      },
      {
        label: "Connecteurs",
        href: "/administration/connecteurs",
        icon: PlugZap,
        description: "Gmail, calendrier, cloud, banques.",
        badge: "Bientôt",
        disabled: true,
      },
      {
        label: "Sécurité",
        href: "/administration/securite",
        icon: ShieldCheck,
        description: "Authentification, sessions, accès.",
        badge: "Bientôt",
        disabled: true,
      },
      {
        label: "Logs techniques",
        href: "/administration/logs",
        icon: Bug,
        description: "Erreurs techniques et diagnostic.",
        badge: "Bientôt",
        disabled: true,
      },
      {
        label: "Ouvrir Paperless",
        href: "",
        icon: ExternalLink,
        description: "Accès à l'interface Paperless originale.",
        external: true,
      },
    ],
  },
];

/**
 * URLs qui activent visuellement le bouton « Administration » de la topbar.
 * (Toute route ouverte par le dropdown.)
 */
export const ADMINISTRATION_ACTIVE_PREFIXES: readonly string[] = [
  "/administration",
  "/activite",
  "/journaux",
  "/workflows",
  "/emails",
  "/import",
  "/utilisateurs",
  "/groupes",
  "/profil",
  "/tokens",
  "/parametres",
  "/statut",
] as const;

export function isAdministrationRoute(pathname: string): boolean {
  return ADMINISTRATION_ACTIVE_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
