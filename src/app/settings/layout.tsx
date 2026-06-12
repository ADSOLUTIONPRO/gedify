import type { ReactNode } from "react";

/* Enveloppe `au-scope` : applique le design system Admin (champs et tables
   lisibles) à toutes les pages /settings/* du client, sans les réécrire.
   Les gardes d'accès (membre du tenant) restent dans chaque page/redirection. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div className="au-scope">{children}</div>;
}
