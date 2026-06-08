import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * « À traiter » réutilise désormais la VRAIE liste documentaire (même grille /
 * tableau / filtres / actions groupées / Ouvrir / Fiche Doc que Tous les
 * documents), filtrée aux documents à traiter via ?tab=a-traiter — fini les
 * formulaires permanents au milieu de la liste. Redirection pour les anciens
 * liens / favoris navigateur.
 */
export default function ATraiterPage() {
  redirect("/documents?tab=a-traiter");
}
