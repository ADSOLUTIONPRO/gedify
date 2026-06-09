import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Les paramètres GEDify sont désormais intégrés à la page Administration
 * (/administration → Configuration GEDify + À propos). Cette route ne fait que
 * rediriger (implémentation unique, compat favoris/anciens liens, pas de 404).
 */
export default function AdministrationParametresRedirect() {
  redirect("/administration");
}
