import { redirect } from "next/navigation";
import type { PageSearchParams } from "@/lib/page-params";
import { firstParam } from "@/lib/page-params";

export const dynamic = "force-dynamic";

/**
 * Ancienne route « Connecter une boîte mail » : le parcours est désormais
 * intégralement géré dans la modale de la page Paramètres des Emails
 * (ConnectMailboxModal). On redirige donc vers cette page en demandant
 * l'ouverture automatique de la modale, en conservant les éventuels paramètres
 * de reprise OAuth / fournisseur. Plus aucune interface dupliquée ici.
 */
export default async function ConnecterBoiteMailRedirect({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams({ modal: "connect-mailbox" });
  const provider = firstParam(params, "provider");
  if (provider) query.set("provider", provider);
  for (const key of ["gmail_error", "outlook_error", "gmail", "outlook", "accountId"]) {
    const value = firstParam(params, key);
    if (value) query.set(key, value);
  }
  redirect(`/messagerie/parametres-emails?${query.toString()}`);
}
