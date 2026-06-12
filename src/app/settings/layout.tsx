import type { ReactNode } from "react";
import "@/components/settings/settings-ui.css";

/* SettingsTenantCleanLayout — layout dédié à /settings (espace tenant).
   AUCUNE sidebar GED, aucun rail d'icônes, aucune topbar globale, aucun menu
   SuperAdmin : le chrome global (AppShell) est désactivé pour /settings/* dans
   le layout racine (src/app/layout.tsx). `au-scope` garde les champs et tables
   des pages internes lisibles, sans réintroduire de chrome. */
export default function SettingsTenantCleanLayout({ children }: { children: ReactNode }) {
  return <main className="st-only au-scope">{children}</main>;
}
