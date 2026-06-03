import { type NextRequest, NextResponse } from "next/server";
import { createFirstAdmin, hasAnyUser } from "@/lib/engine/users";
import { signSession, cookieOpts } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Première connexion (installation).
 *  - GET  : indique s'il reste un administrateur à créer.
 *  - POST : crée le compte administrateur initial puis ouvre une session.
 * Une fois un utilisateur présent, l'endpoint refuse toute création (409).
 */
export async function GET() {
  const authConfigured = Boolean(process.env.AUTH_SECRET?.trim());
  try {
    return NextResponse.json({ needsSetup: !(await hasAnyUser()), authConfigured });
  } catch {
    return NextResponse.json({ needsSetup: false, authConfigured }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.AUTH_SECRET?.trim()) {
      return NextResponse.json(
        { error: "Authentification non configurée — AUTH_SECRET manquant." },
        { status: 503 },
      );
    }

    if (await hasAnyUser()) {
      return NextResponse.json(
        { error: "L'application est déjà initialisée. Connectez-vous." },
        { status: 409 },
      );
    }

    const body = (await req.json()) as {
      username?: string;
      password?: string;
      email?: string;
    };
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    const email = (body.email ?? "").trim();

    if (username.length < 3) {
      return NextResponse.json(
        { error: "L'identifiant doit contenir au moins 3 caractères." },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères." },
        { status: 400 },
      );
    }

    try {
      await createFirstAdmin({ username, password, email });
    } catch (e) {
      // Course : un admin a été créé entre-temps.
      if (e instanceof Error && e.message === "already_initialized") {
        return NextResponse.json(
          { error: "L'application est déjà initialisée. Connectez-vous." },
          { status: 409 },
        );
      }
      throw e;
    }

    // Auto-connexion du nouvel administrateur.
    const token = await signSession({ username });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieOpts(token));
    return res;
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
