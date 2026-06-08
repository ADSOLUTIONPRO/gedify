import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Résout l'utilisateur courant pour la portée des conversations IA.
 * - Refuse (401/redirect) si non authentifié → { deny }.
 * - Sinon → { userId } (id stable, ou "local" en mode GEDIFY_LOCAL_NO_AUTH).
 * La portée par userId garantit qu'un utilisateur ne voit/charge QUE ses
 * conversations (contrôle côté serveur, pas seulement frontend).
 */
export async function resolveAssistantUser(
  req: NextRequest,
): Promise<{ userId: string; deny?: undefined } | { userId?: undefined; deny: NextResponse }> {
  const deny = await requireAuth(req);
  if (deny) return { deny };
  const user = await getCurrentUser();
  return { userId: user ? String(user.id) : "local" };
}
