"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { signSession, cookieOpts } from "@/lib/auth/session";
import { listUsers, createUser } from "@/lib/engine/users";
import { getInvitationByToken, acceptTenantInvitation } from "@/lib/saas/invitations";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }

/** Acceptation d'une invitation. Token opaque, à usage unique côté serveur. */
export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = s(formData.get("token"));
  if (!token) redirect("/invite/invalid");
  const inv = await getInvitationByToken(token).catch(() => null);
  if (!inv || inv.status !== "pending") redirect(`/invite/${token}?error=` + encodeURIComponent("Invitation invalide ou déjà utilisée."));

  const me = await getCurrentUser().catch(() => null);

  // Cas 1 : utilisateur déjà connecté → doit correspondre à l'email invité (ou superuser).
  if (me) {
    const sameEmail = (me.email ?? "").trim().toLowerCase() === inv.email.toLowerCase();
    if (!sameEmail && !me.is_superuser) {
      redirect(`/invite/${token}?error=` + encodeURIComponent(`Connectez-vous avec l'adresse invitée (${inv.email}).`));
    }
    try { await acceptTenantInvitation(token, me.id); }
    catch (e) { redirect(`/invite/${token}?error=` + encodeURIComponent(e instanceof Error ? e.message : "Erreur")); }
    redirect("/select-tenant?joined=1");
  }

  // Cas 2 : pas de session. Compte existant pour cet email → demander connexion.
  const existing = (await listUsers()).find((u) => (u.email ?? "").trim().toLowerCase() === inv.email.toLowerCase());
  if (existing) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}&reason=invite`);
  }

  // Cas 3 : création de compte avec mot de passe choisi.
  const password = s(formData.get("password"));
  if (password.length < 8) redirect(`/invite/${token}?error=` + encodeURIComponent("Choisissez un mot de passe d'au moins 8 caractères."));
  let userId: number;
  try {
    const user = await createUser({ username: inv.email, email: inv.email, password });
    userId = user.id;
    await acceptTenantInvitation(token, userId);
  } catch (e) {
    redirect(`/invite/${token}?error=` + encodeURIComponent(e instanceof Error ? e.message : "Erreur lors de la création du compte."));
  }
  // Connexion immédiate (session) puis redirection.
  const jwt = await signSession({ username: inv.email });
  (await cookies()).set(cookieOpts(jwt));
  redirect("/dashboard?welcome=1");
}
