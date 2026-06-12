/* Design system Admin/Paramètres Gedify — point d'entrée unique.
   Importer la feuille de style une seule fois (cf. src/app/layout.tsx).
   Usage : import { AdminCard, AdminInput, AdminDataTable, … } from "@/components/admin-ui"; */

export { AdminField, AdminInput, AdminSelect, AdminTextarea, AdminCheckbox, AdminSwitch, AdminButton, AdminFormSection, AdminFormActions } from "./form";
export { AdminCard, AdminStatCard, AdminStats, AdminBadge, AdminAlert, AdminEmptyState, AdminNavTile, AdminNavGrid, AdminTabs, AdminToolbar, AdminToolbarSpacer, AdminScopeBadge } from "./layout";
export { AdminDataTable, type AdminColumn } from "./table";
export {
  SuperAdminPageShell, SuperAdminHero, SuperAdminMetricGrid, SuperAdminMetricCard,
  SuperAdminPanel, SuperAdminSectionHeader, SuperAdminGrid, SuperAdminQuickBar, SuperAdminActionCard,
  SuperAdminAlertList, SuperAdminTableCard, type SuperAdminMetricVariant,
} from "./superadmin";
