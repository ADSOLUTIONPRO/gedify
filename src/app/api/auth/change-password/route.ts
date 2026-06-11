import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { verifyCredentials, updateUser } from "@/lib/engine/users";
import { jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Changement du mot de passe du COMPTE COURANT (depuis la page Profil).
 * Vérifie le mot de passe actuel, impose ≥ 8 caractères et une confirmation,
 * puis met à jour le hash bcrypt. Ne touche à aucun autre compte.
 */
export async function POST(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Session invalide — reconnectez-vous." }, { status: 401 });
    }

    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." },
        { status: 400 },
      );
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "La confirmation ne correspond pas au nouveau mot de passe." },
        { status: 400 },
      );
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit être différent de l'actuel." },
        { status: 400 },
      );
    }

    // Vérifie le mot de passe actuel (sauf compte sans mot de passe défini, où
    // l'on autorise l'initialisation directe).
    const hasPassword = Boolean(user.passwordHash && user.passwordHash.trim());
    if (hasPassword) {
      const ok = await verifyCredentials(user.username, currentPassword);
      if (!ok) {
        // Délai constant : limite les attaques par timing.
        await new Promise((r) => setTimeout(r, 200));
        return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
      }
    }

    await updateUser(user.id, { password: newPassword });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Impossible de modifier le mot de passe", error, 500);
  }
}
