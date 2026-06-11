import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Banknote,
  Brain,
  Building2,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  DatabaseBackup,
  FileText,
  FileType2,
  FolderTree,
  Gauge,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  ListChecks,
  Mail,
  PenLine,
  Receipt,
  RefreshCw,
  Repeat,
  Send,
  Settings,
  Sliders,
  Sparkles,
  Star,
  Tags,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  Workflow,
  Wrench,
} from "lucide-react";
import { getSpaceByHref } from "@/config/spaces";

/* ── Types ─────────────────────────────────────────────────────────────── */

export type SpaceMenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Clé de groupe (référence un `SpaceMenuGroup.id`). Optionnel. */
  group?: string;
  /** Sous-titre explicatif (affiché si la sidebar est assez large). */
  subtitle?: string;
};
export type SpaceMenuAction = { label: string; href: string; icon: LucideIcon };
export type SpaceMenuGroup = { id: string; title: string; subtitle?: string };

export type SpaceMenu = {
  /** id = id d'espace (`@/config/spaces`) ou "accueil". */
  id: string;
  title: string;
  description?: string;
  /** Couleur d'accent (hex). Défaut repris de l'espace. */
  color?: string;
  /** Bouton d'action rapide en tête de menu (optionnel). */
  action?: SpaceMenuAction;
  /** Groupes visuels du menu (titre + sous-titre). Si absent → liste plate. */
  groups?: SpaceMenuGroup[];
  items: SpaceMenuItem[];
};

/* ── Ordre du rail d'applications ──────────────────────────────────────── */

export const RAIL_PRIMARY = [
  "documents",
  "finances",
  "messagerie",
  "contacts",
  "agenda",
] as const;

// "gestion-clients" (SaaS) est placé juste AVANT "administration". Le rail le
// masque pour les non-superusers (cf. AppsRail `saasAdmin`).
export const RAIL_SECONDARY = ["organiser", "office", "gestion-clients", "administration"] as const;

/* ── Menus par espace (allégés : uniquement l'essentiel) ───────────────── */

export const SPACE_MENUS: Record<string, SpaceMenu> = {
  accueil: {
    id: "accueil",
    title: "Accueil",
    description: "Votre tableau de bord",
    items: [
      { label: "Tableau de bord", href: "/", icon: LayoutDashboard },
      { label: "Activité récente", href: "/activite", icon: Activity },
      { label: "Actions rapides", href: "/#actions-rapides", icon: Sparkles },
      { label: "Personnalisation", href: "/#personnalisation", icon: Sliders },
    ],
  },

  documents: {
    id: "documents",
    title: "Documents",
    description: "Tous vos documents indexés",
    action: { label: "Importer", href: "/import", icon: Upload },
    groups: [
      { id: "docs", title: "Documents", subtitle: "Consulter et trier vos documents" },
      { id: "orga", title: "Organisation & taxonomies", subtitle: "Structurer et automatiser" },
    ],
    items: [
      { label: "Tous les documents", href: "/documents", icon: FileText, group: "docs", subtitle: "Ensemble de la GED" },
      { label: "Récents", href: "/documents?tab=recents", icon: Clock, group: "docs", subtitle: "Ajoutés il y a moins de 48 h" },
      { label: "Favoris", href: "/documents?tab=favoris", icon: Star, group: "docs", subtitle: "Documents marqués d'une étoile" },
      { label: "À traiter", href: "/documents/a-traiter", icon: Inbox, group: "docs", subtitle: "À valider ou à compléter" },
      { label: "Archives", href: "/documents/archives", icon: Archive, group: "docs", subtitle: "Documents archivés" },
      { label: "Corbeille", href: "/corbeille", icon: Trash2, group: "docs", subtitle: "Documents supprimés" },
      { label: "Doublons", href: "/documents/doublons", icon: Copy, group: "docs", subtitle: "Détecter et fusionner les doublons" },
      { label: "Signatures & paraphes", href: "/documents/signatures", icon: PenLine, group: "orga", subtitle: "Gérer vos signatures" },
      { label: "Types de documents", href: "/organiser/types", icon: FileType2, group: "orga", subtitle: "Catégoriser vos documents" },
      { label: "Tags", href: "/organiser/tags", icon: Tags, group: "orga", subtitle: "Étiquettes et mots-clés" },
      { label: "Vues", href: "/organiser/vues", icon: LayoutGrid, group: "orga", subtitle: "Vues personnalisées" },
      { label: "Workflows", href: "/workflows", icon: Workflow, group: "orga", subtitle: "Automatiser vos processus" },
      { label: "Modèles IA appris", href: "/documents/modeles-ia", icon: Brain, group: "orga", subtitle: "Modèles entraînés par l'IA" },
    ],
  },

  messagerie: {
    id: "messagerie",
    title: "Messagerie",
    description: "Emails & pièces jointes",
    action: { label: "Nouveau message", href: "/messagerie", icon: PenLine },
    items: [
      { label: "Boîte de réception", href: "/messagerie/inbox", icon: Inbox },
      { label: "Envoyés", href: "/messagerie/envoyes", icon: Send },
      { label: "Brouillons", href: "/messagerie/brouillons", icon: PenLine },
      { label: "Archives", href: "/messagerie/archives", icon: Archive },
      { label: "Corbeille", href: "/messagerie?dossier=corbeille", icon: Trash2 },
    ],
  },

  finances: {
    id: "finances",
    title: "Finances",
    description: "Budget, revenus & échéances",
    items: [
      { label: "Vue d'ensemble", href: "/finances", icon: Gauge },
      { label: "À encaisser", href: "/finances/a-encaisser", icon: Banknote },
      { label: "Encaissements", href: "/finances/revenus", icon: Wallet },
      { label: "Factures", href: "/finances/documents", icon: Receipt },
    ],
  },

  calendrier: {
    id: "calendrier",
    title: "Calendrier",
    description: "Agenda & échéances",
    action: { label: "Nouvel événement", href: "/calendrier", icon: CalendarDays },
    items: [
      { label: "Agenda", href: "/calendrier", icon: Calendar },
      { label: "Rendez-vous détectés", href: "/calendrier?vue=detectes", icon: CalendarClock },
      { label: "Synchronisations", href: "/calendrier?vue=sync", icon: RefreshCw },
      { label: "Paramètres agenda", href: "/calendrier?vue=parametres", icon: Settings },
    ],
  },

  contacts: {
    id: "contacts",
    title: "Contacts",
    description: "Tous vos contacts, multi-sources",
    action: { label: "Tout synchroniser", href: "/messagerie/contacts", icon: RefreshCw },
    items: [
      { label: "Tous les contacts", href: "/messagerie/contacts", icon: Users },
      { label: "Google", href: "/messagerie/contacts?source=google", icon: Link2 },
      { label: "Emails", href: "/messagerie/contacts?source=imap_email", icon: Mail },
      { label: "Correspondants GEDify", href: "/messagerie/contacts?source=correspondents", icon: UserPlus },
      { label: "Manuels", href: "/messagerie/contacts?source=manual", icon: PenLine },
      { label: "Doublons", href: "/messagerie/contacts?source=doublons", icon: Copy },
    ],
  },

  agenda: {
    id: "agenda",
    title: "Agenda & tâches",
    description: "Calendrier, tâches, rappels & échéances",
    action: { label: "Nouvelle tâche", href: "/rappels", icon: ListChecks },
    items: [
      { label: "Calendrier", href: "/calendrier", icon: Calendar },
      { label: "Rendez-vous détectés", href: "/calendrier?vue=detectes", icon: CalendarClock },
      { label: "Mes tâches", href: "/rappels", icon: ListChecks },
      { label: "À venir", href: "/rappels/a-venir", icon: Clock },
      { label: "En retard", href: "/rappels/en-retard", icon: AlertTriangle },
      { label: "Tâches automatiques", href: "/rappels/recurrents", icon: Repeat },
    ],
  },

  administration: {
    id: "administration",
    title: "Administration",
    description: "Gouvernance, configuration & maintenance",
    groups: [
      { id: "configuration", title: "Configuration système" },
      { id: "support", title: "Support & maintenance" },
    ],
    items: [
      // Configuration système
      { label: "Sauvegardes & restauration", href: "/administration/sauvegarde", icon: DatabaseBackup, group: "configuration" },
      // Support & maintenance
      { label: "Outils de maintenance", href: "/administration#maintenance", icon: Wrench, group: "support" },
    ],
  },

  "gestion-clients": {
    id: "gestion-clients",
    title: "Gestion clients",
    description: "Administration SaaS (superuser)",
    groups: [
      { id: "pilotage", title: "Pilotage" },
      { id: "offres", title: "Offres & finances" },
      { id: "acces", title: "Clients & accès" },
      { id: "exploitation", title: "Exploitation" },
    ],
    items: [
      { label: "Tableau de bord SaaS", href: "/admin/saas", icon: LayoutDashboard, group: "pilotage" },
      { label: "Clients / Espaces", href: "/admin/saas/tenants", icon: LayoutGrid, group: "pilotage" },
      { label: "Créer un client", href: "/admin/saas/create-tenant", icon: UserPlus, group: "pilotage" },
      { label: "Plans & offres", href: "/admin/saas/plans", icon: Sliders, group: "offres" },
      { label: "Codes promo", href: "/admin/saas/promo-codes", icon: Tags, group: "offres" },
      { label: "Gratuités offertes", href: "/admin/saas/grants", icon: Star, group: "offres" },
      { label: "Quotas & usages", href: "/admin/saas/usage", icon: Gauge, group: "offres" },
      { label: "Abonnements", href: "/admin/saas/subscriptions", icon: Repeat, group: "offres" },
      { label: "Facturation", href: "/admin/saas/billing", icon: Receipt, group: "offres" },
      { label: "Factures", href: "/admin/saas/billing/invoices", icon: FileText, group: "offres" },
      { label: "Profil émetteur", href: "/admin/saas/billing/profile", icon: Building2, group: "offres" },
      { label: "Stripe", href: "/admin/saas/stripe", icon: Banknote, group: "offres" },
      { label: "Mailing", href: "/admin/saas/mailing", icon: Mail, group: "exploitation" },
      { label: "Périodes d'essai", href: "/admin/saas/trials", icon: Clock, group: "offres" },
      { label: "Invitations clients", href: "/admin/saas/invitations", icon: Send, group: "acces" },
      { label: "Membres clients", href: "/admin/saas/memberships", icon: Users, group: "acces" },
      { label: "Domaines clients", href: "/admin/saas/domains", icon: Link2, group: "acces" },
      { label: "Sécurité clients", href: "/admin/saas/security", icon: AlertTriangle, group: "exploitation" },
      { label: "Diagnostics SaaS", href: "/admin/saas/diagnostics", icon: Activity, group: "exploitation" },
      { label: "Paramètres SaaS", href: "/admin/saas/settings", icon: Settings, group: "exploitation" },
    ],
  },

  office: {
    id: "office",
    title: "Office",
    description: "Rédaction & modèles",
    action: { label: "Nouveau document", href: "/redaction/nouveau", icon: PenLine },
    items: [
      { label: "Rédaction", href: "/redaction", icon: PenLine },
      { label: "Modèles", href: "/redaction/modeles", icon: FileType2 },
    ],
  },

  organiser: {
    id: "organiser",
    title: "Organiser",
    description: "Dossiers, projets & taxonomies",
    items: [
      { label: "Dossiers / Projets", href: "/organiser/dossiers", icon: FolderTree },
    ],
  },

  actions: {
    id: "actions",
    title: "Actions",
    description: "Tâches & suivi",
    action: { label: "Nouvelle action", href: "/actions", icon: ListChecks },
    items: [
      { label: "Toutes les actions", href: "/actions", icon: ListChecks },
      { label: "À faire", href: "/actions/a-faire", icon: Inbox },
      { label: "En cours", href: "/actions/en-cours", icon: Clock },
      { label: "Terminées", href: "/actions/terminees", icon: CheckCircle2 },
    ],
  },
};

/* ── Résolution de l'espace actif selon l'URL ──────────────────────────── */

/**
 * Routes orphelines (pas un préfixe d'espace dans `spaces`) rattachées
 * manuellement à un espace pour que la 2ᵉ sidebar reste pertinente.
 * Ordre = priorité (premier préfixe correspondant gagne).
 */
const ORPHAN_PREFIXES: [string, string][] = [
  ["/a-traiter", "documents"],
  ["/corbeille", "documents"],
  ["/types", "documents"],
  ["/tags", "documents"],
  ["/import", "documents"],
  ["/dossiers", "organiser"],
  ["/budget", "finances"],
  ["/redaction", "office"],
  ["/emails", "administration"],
  ["/utilisateurs", "administration"],
  ["/groupes", "administration"],
  ["/profil", "administration"],
  ["/tokens", "administration"],
  ["/parametres", "administration"],
  ["/statut", "administration"],
  ["/journaux", "administration"],
  ["/stockage", "administration"],
  // Workflows déplacé dans l'espace Documents (menu Documents).
  ["/workflows", "documents"],
  ["/champs-personnalises", "administration"],
  ["/vues", "administration"],
  ["/mise-en-place", "administration"],
  ["/activite", "accueil"],
  ["/recherche", "accueil"],
  ["/dashboard", "accueil"],
];

/** Détermine l'id d'espace actif à partir d'un pathname. Toujours défini. */
export function getActiveSpaceId(pathname: string): string {
  if (pathname === "/") return "accueil";
  // Gestion clients (SaaS, superuser) — sauf /admin/saas/tenant (= espace courant
  // de l'owner, qui ne fait pas partie de l'admin SaaS globale).
  if (/^\/admin\/saas(\/|$)/.test(pathname) && pathname !== "/admin/saas/tenant") return "gestion-clients";
  // Hiérarchie simplifiée : espaces fusionnés (priment sur la résolution par href).
  // - Contacts = page multi-sources + correspondants.
  if (pathname.startsWith("/messagerie/contacts")) return "contacts";
  if (pathname === "/correspondants" || pathname.startsWith("/correspondants/")) return "contacts";
  // - Agenda & tâches = calendrier + actions + rappels (Mes tâches).
  if (/^\/(actions|rappels|calendrier)(\/|$)/.test(pathname)) return "agenda";
  // - Analyse IA : déplacée dans Administration (plus dans le rail utilisateur).
  if (/^\/ia(\/|$)/.test(pathname)) return "administration";
  // - Taxonomies sous /organiser/* (types/tags/vues) rattachées à Documents
  //   (l'espace Organiser garde Dossiers/Projets).
  if (/^\/organiser\/(types|tags|vues)(\/|$)/.test(pathname)) return "documents";
  const space = getSpaceByHref(pathname);
  if (space && SPACE_MENUS[space.id]) return space.id;
  for (const [prefix, id] of ORPHAN_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return id;
  }
  return "accueil";
}

export function getSpaceMenu(id: string): SpaceMenu {
  return SPACE_MENUS[id] ?? SPACE_MENUS.accueil;
}
