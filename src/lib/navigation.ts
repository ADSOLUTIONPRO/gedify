import type { LucideIcon } from "lucide-react";
import {
  Activity,
  KeyRound,
  Mail,
  ScrollText,
  Server,
  Settings,
  UserCircle,
  UserCog,
  UsersRound,
  Workflow,
} from "lucide-react";
import {
  administrationDropdownNavigation,
  dailySidebarNavigation,
  type NavigationItem as ConfigNavigationItem,
} from "@/config/app-navigation";

/**
 * Wrapper rétro-compatible autour de `src/config/app-navigation.ts`.
 *
 * - `navigationGroups` est consommé par `Sidebar` / `MobileSidebar` avec les
 *   anciens noms de champs (`name`, `items[].name`). On adapte ici la config
 *   centralisée vers ce contrat.
 * - Les items qui appartiennent au menu Administration (cf. topbar dropdown)
 *   ne sont PLUS exposés dans `navigationGroups` — la sidebar reste
 *   focalisée sur l'usage quotidien.
 */

export type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: string;
};

export type NavigationGroup = {
  name: string;
  items: NavigationItem[];
};

function toLegacyItem(item: ConfigNavigationItem): NavigationItem {
  return {
    name: item.label,
    href: item.href,
    icon: item.icon,
    badgeKey: item.badgeKey,
  };
}

export const navigationGroups: NavigationGroup[] = dailySidebarNavigation.map((section) => ({
  name: section.section,
  items: section.items
    .filter((item) => !item.disabled && !item.external)
    .map(toLegacyItem),
}));

export const navigation = navigationGroups.flatMap((group) => group.items);

/**
 * Compatibilité descendante : ces exports étaient utilisés par l'ancienne
 * page `/administration`. On les expose toujours pour ne pas casser les
 * imports existants, mais la source de vérité est désormais
 * `administrationDropdownNavigation`.
 */

export type AdminItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

const ADMIN_FALLBACK_ICONS: LucideIcon[] = [
  Activity,
  Mail,
  ScrollText,
  Settings,
  Server,
  KeyRound,
  Workflow,
  UserCog,
  UsersRound,
  UserCircle,
];

void ADMIN_FALLBACK_ICONS;

export const adminItems: AdminItem[] = administrationDropdownNavigation.flatMap((section) =>
  section.items
    .filter((item) => !item.disabled && !item.external)
    .map((item) => ({
      name: item.label,
      href: item.href,
      icon: item.icon,
      description: item.description ?? "",
    }))
);

export const adminHrefs = new Set(adminItems.map((item) => item.href));
