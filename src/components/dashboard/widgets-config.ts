/**
 * Registre des widgets du dashboard (maquette validée).
 * Les widgets « grille » (`GRID_WIDGETS`) relient leur clé à un espace
 * (`@/config/spaces`) pour réutiliser icône image + href + couleur.
 */
export type WidgetKey =
  | "quick-actions"
  | "activite-recente"
  | "documents"
  | "messagerie"
  | "finances"
  | "ia"
  | "calendrier"
  | "contacts"
  | "rappels"
  | "administration";

export type WidgetDef = { key: WidgetKey; label: string };

/** Ordre = ordre d'affichage dans le panneau « Widgets dashboard ». */
export const DASHBOARD_WIDGETS: WidgetDef[] = [
  { key: "quick-actions", label: "Actions rapides" },
  { key: "documents", label: "Documents" },
  { key: "messagerie", label: "Messagerie" },
  { key: "finances", label: "Finances" },
  { key: "ia", label: "Analyse IA" },
  { key: "calendrier", label: "Calendrier" },
  { key: "contacts", label: "Contacts" },
  { key: "rappels", label: "Rappels" },
  { key: "administration", label: "Administration" },
];

/** Widgets de la grille de cartes (sous la ligne « Vue d'ensemble / Actions »). */
export type GridWidgetKey = "documents" | "messagerie" | "finances" | "ia" | "calendrier" | "contacts" | "rappels" | "administration";
export const GRID_WIDGETS: { key: GridWidgetKey; spaceId: string }[] = [
  { key: "documents", spaceId: "documents" },
  { key: "messagerie", spaceId: "messagerie" },
  { key: "finances", spaceId: "finances" },
  { key: "ia", spaceId: "ia" },
  { key: "calendrier", spaceId: "calendrier" },
  { key: "contacts", spaceId: "contacts" },
  { key: "rappels", spaceId: "rappels" },
  { key: "administration", spaceId: "administration" },
];

export const DASHBOARD_WIDGETS_STORAGE_KEY = "ged-dashboard-widgets-v3";

/**
 * Visibilité par défaut : tous les widgets réarrangeables sont affichés.
 * (La « Vue d'ensemble » a été retirée — elle doublait les 4 widgets-stat.)
 */
const DEFAULT_HIDDEN: WidgetKey[] = [];

export function defaultVisibility(): Record<WidgetKey, boolean> {
  return DASHBOARD_WIDGETS.reduce(
    (acc, w) => {
      acc[w.key] = !DEFAULT_HIDDEN.includes(w.key);
      return acc;
    },
    {} as Record<WidgetKey, boolean>,
  );
}
