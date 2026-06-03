import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { importFromZip, type ImportMode } from "@/lib/transfer/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPLACE_CONFIRM = "IMPORT_REPLACE";

/**
 * Import d'une archive .zip Gedify.
 *
 * Le zip est envoyé EN CORPS BRUT (Content-Type: application/zip), pas en
 * multipart : le parseur multipart d'undici étouffe sur les gros corps dans
 * le serveur Next standalone. La lecture brute (arrayBuffer) est fiable et
 * permet de comparer les octets reçus à la taille annoncée pour distinguer
 * une vraie troncature proxy d'un zip corrompu.
 *
 * Paramètres en query string : ?mode=replace|merge&confirm=IMPORT_REPLACE
 */
export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const params = request.nextUrl.searchParams;
  const mode: ImportMode = params.get("mode") === "merge" ? "merge" : "replace";
  if (mode === "replace" && params.get("confirm") !== REPLACE_CONFIRM) {
    return NextResponse.json(
      { error: `Confirmation requise pour le mode « remplacer ». Ajoutez ?confirm=${REPLACE_CONFIRM}.` },
      { status: 400 },
    );
  }

  const announced = Number(request.headers.get("content-length") ?? 0);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await request.arrayBuffer());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Lecture du corps de la requête impossible.",
        details:
          `${error instanceof Error ? error.message : String(error)} — Content-Length annoncé : ${announced || "inconnu"}. ` +
          "Le flux a été interrompu : si l'archive est volumineuse, augmentez la limite de taille d'upload du proxy (Coolify / Traefik / nginx).",
      },
      { status: 400 },
    );
  }

  if (buffer.byteLength === 0) {
    return NextResponse.json(
      { error: "Corps de requête vide.", details: `Aucun octet reçu (Content-Length annoncé : ${announced || "inconnu"}). Envoyez le .zip dans le corps de la requête.` },
      { status: 400 },
    );
  }

  // Octets reçus < taille annoncée → le corps a été tronqué en amont (proxy).
  if (announced > 0 && buffer.byteLength < announced) {
    return NextResponse.json(
      {
        error: "Archive tronquée par le proxy.",
        details:
          `Reçu ${buffer.byteLength} octets sur ${announced} annoncés. Le proxy limite la taille d'upload — ` +
          "augmentez-la côté Coolify / Traefik (maxRequestBodyBytes / buffering) ou nginx (client_max_body_size).",
      },
      { status: 413 },
    );
  }

  try {
    const summary = await importFromZip(buffer, { mode });
    return NextResponse.json(summary);
  } catch (error) {
    return jsonError("Erreur lors de l'import des données", error, 400);
  }
}
