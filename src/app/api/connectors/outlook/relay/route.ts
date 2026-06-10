import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────────────────
   RELAIS OAuth Microsoft (multi-tenant).

   Une URL de callback UNIQUE, hébergée par l'éditeur et enregistrée UNE SEULE
   FOIS dans l'app Azure partagée. Microsoft renvoie ici le `code` + `state` ;
   le relais le réachemine vers le callback de l'INSTANCE qui a initié le flux
   (URL transportée en clair dans le `state`).

   Le relais ne détient AUCUN secret et ne voit jamais de token : il ne fait
   qu'un 302 vers l'instance. Le code est inutilisable sans le `code_verifier`
   PKCE (chiffré dans le state, connu de la seule instance légitime), et le state
   est signé (HMAC) par l'instance → le relais ne peut rien forger.

   Activé uniquement sur l'instance DÉSIGNÉE comme relais (MICROSOFT_RELAY_ENABLED=1)
   pour éviter qu'une instance quelconque ne serve de redirecteur ouvert.
   ──────────────────────────────────────────────────────────────────────── */

function relayEnabled(): boolean {
  const v = process.env.MICROSOFT_RELAY_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

/** Lit (sans vérifier la signature — le relais n'a pas le secret de l'instance)
 *  le champ `instanceCallback` du state signé `<base64url(json)>.<sig>`. */
function readInstanceCallback(state: string): string | null {
  try {
    const rawB64 = state.split(".")[0];
    if (!rawB64) return null;
    const json = Buffer.from(rawB64, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { instanceCallback?: unknown };
    return typeof parsed.instanceCallback === "string" ? parsed.instanceCallback : null;
  } catch {
    return null;
  }
}

/** N'accepte que des callbacks HTTPS pointant vers la route d'instance attendue
 *  (réduit l'usage du relais comme redirecteur ouvert). */
function isAllowedCallback(url: string): URL | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (u.pathname !== "/api/connectors/outlook/callback") return null;
    return u;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!relayEnabled()) {
    return NextResponse.json({ error: "Relais OAuth désactivé." }, { status: 404 });
  }

  const sp = request.nextUrl.searchParams;
  const state = sp.get("state");
  if (!state) return NextResponse.json({ error: "state manquant." }, { status: 400 });

  const callbackRaw = readInstanceCallback(state);
  const target = callbackRaw ? isAllowedCallback(callbackRaw) : null;
  if (!target) {
    return NextResponse.json({ error: "Callback d'instance absent ou non autorisé dans le state." }, { status: 400 });
  }

  // Réachemine tels quels les paramètres OAuth (code/state ou error/description).
  for (const key of ["code", "state", "error", "error_description"]) {
    const v = sp.get(key);
    if (v != null) target.searchParams.set(key, v);
  }
  return NextResponse.redirect(target.toString());
}
