import { TriangleAlert } from "lucide-react";

/**
 * Bandeau d'ENVIRONNEMENT (préparation SaaS Coolify).
 *
 * Affiche un bandeau bien visible UNIQUEMENT lorsque
 * `NEXT_PUBLIC_APP_ENV === "staging"` :
 *   « ENVIRONNEMENT STAGING — données de test »
 *
 * - Ne rend RIEN en production (ni dans les autres environnements).
 * - Non bloquant : reste dans le flux en haut de page (sticky), n'empêche
 *   aucune interaction et ne masque pas le contenu.
 *
 * Composant serveur (comme AuthSetupBanner) — lit la variable au runtime, donc
 * compatible avec une valeur injectée par Coolify sans rebuild côté serveur.
 */
export function EnvironmentBanner() {
  const env = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();

  if (env !== "staging" && env !== "stage") return null;

  return (
    <div
      role="status"
      aria-label="Environnement de staging"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-center text-[13px] font-extrabold uppercase tracking-wide"
      style={{
        background: "#C2410C", // orange-700 : se distingue du bandeau auth (jaune)
        color: "#FFFFFF",
        borderBottom: "1px solid #9A3412",
        letterSpacing: "0.04em",
      }}
    >
      <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      <span>Environnement staging — données de test</span>
    </div>
  );
}
