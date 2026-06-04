import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { readStore, STORE, type EngineUser } from "@/lib/engine/stores";
import { requireAuth } from "@/lib/auth/require-auth";
import { can, roleOf, type Permission, type Role } from "@/lib/auth/permissions";

/* Résolution de l'utilisateur courant + garde de permission pour les routes API. */

/** Utilisateur de la session courante (ou null). */
export async function getCurrentUser(): Promise<EngineUser | null> {
  const session = await readSession();
  if (!session?.username) return null;
  const users = await readStore<EngineUser[]>(STORE.users, []);
  return users.find((u) => u.username.toLowerCase() === session.username.toLowerCase()) ?? null;
}

export async function getCurrentRole(): Promise<Role> {
  return roleOf(await getCurrentUser());
}

/**
 * Garde de permission : 401 si non authentifié, 403 si authentifié mais sans
 * droit. Sûr : un superuser, ou un utilisateur non résolu, est traité comme
 * admin (jamais de verrouillage de l'unique compte actuel). Retourne null si OK.
 */
export async function requirePermission(
  req: NextRequest | undefined,
  permission: Permission,
): Promise<NextResponse | null> {
  if (process.env.GEDIFY_LOCAL_NO_AUTH === "1") return null;

  const deny = await requireAuth(req);
  if (deny) return deny;

  const user = await getCurrentUser();
  if (can(user, permission)) return null;

  return NextResponse.json(
    {
      error: "Accès refusé",
      errorType: "ged_permission",
      message: `Votre rôle ne permet pas cette action (${permission}).`,
    },
    { status: 403 },
  );
}
