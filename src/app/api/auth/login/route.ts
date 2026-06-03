import { type NextRequest, NextResponse } from "next/server";
import { verifyPaperlessCredentials } from "@/lib/paperless";
import { signSession, cookieOpts } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Connexion GED = connexion Gedify.
 * On vérifie l'identifiant / mot de passe contre moteur local, puis on crée
 * une session GED locale liée à l'utilisateur Gedify authentifié.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      username?: string;
      identifiant?: string;
      email?: string;
      password?: string;
    };
    // Accepte un login Gedify (ex. "admin"), pas forcément un email.
    const username = (body.username ?? body.identifiant ?? body.email ?? "").trim();
    const password = body.password ?? "";

    if (!process.env.AUTH_SECRET?.trim()) {
      return NextResponse.json(
        { error: "Authentification non configurée — AUTH_SECRET manquant." },
        { status: 503 },
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect." },
        { status: 401 },
      );
    }

    const check = await verifyPaperlessCredentials(username, password);

    if (check.status === "unavailable") {
      return NextResponse.json(
        {
          error:
            "Service d'authentification indisponible — impossible de contacter Gedify. Réessayez plus tard.",
        },
        { status: 503 },
      );
    }

    if (check.status === "invalid") {
      // Délai constant pour limiter les attaques par timing / brute-force.
      await new Promise((r) => setTimeout(r, 200));
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect." },
        { status: 401 },
      );
    }

    const token = await signSession({ username });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieOpts(token));
    return res;
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
