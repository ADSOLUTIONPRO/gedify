import { redirect } from "next/navigation";
import type { PageSearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";

/**
 * Assistant de connexion déplacé dans l'espace Mails :
 * /messagerie/parametres-emails/connecter-bmails. Cette ancienne route ne fait
 * que rediriger (implémentation unique, compat favoris/anciens liens), en
 * préservant les paramètres (provider, gmail_error).
 */
export default async function ConnectMailRedirect({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
  }
  const suffix = qs.toString();
  redirect(`/messagerie/parametres-emails/connecter-bmails${suffix ? `?${suffix}` : ""}`);
}
