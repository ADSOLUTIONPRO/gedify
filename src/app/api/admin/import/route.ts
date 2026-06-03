import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { importFromZip, type ImportMode } from "@/lib/transfer/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPLACE_CONFIRM = "IMPORT_REPLACE";

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = request.headers.get("content-length") ?? "inconnu";

  // Le corps n'est pas arrivé en multipart : presque toujours un proxy qui
  // redirige (HTTP→HTTPS, slash final → POST vidé) ou réécrit le Content-Type.
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      {
        error: "Requête multipart attendue (champ « file »).",
        details:
          `Content-Type reçu : « ${contentType || "(aucun)"} » — taille annoncée : ${contentLength}. ` +
          "Le corps du POST n'est pas en multipart. Cause habituelle derrière un déploiement HTTP : " +
          "un proxy (Coolify/Traefik) qui redirige et vide la requête, ou qui réécrit l'en-tête.",
      },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    // Le Content-Type est multipart mais le parse échoue : corps tronqué
    // (limite de taille d'upload du proxy) ou flux interrompu.
    return NextResponse.json(
      {
        error: "Lecture du multipart impossible (corps tronqué ?).",
        details:
          `${error instanceof Error ? error.message : String(error)} — Content-Length annoncé : ${contentLength}. ` +
          "Si l'archive est volumineuse, augmentez la limite de taille d'upload du proxy (Coolify / Traefik / nginx).",
      },
      { status: 400 },
    );
  }

  const fileEntry = form.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json({ error: "Fichier .zip manquant (champ « file »)." }, { status: 400 });
  }

  const mode: ImportMode = form.get("mode") === "merge" ? "merge" : "replace";
  if (mode === "replace" && form.get("confirm") !== REPLACE_CONFIRM) {
    return NextResponse.json(
      { error: `Confirmation requise pour le mode « remplacer ». Envoyez { confirm: "${REPLACE_CONFIRM}" }.` },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await (fileEntry as File).arrayBuffer());
    const summary = await importFromZip(buffer, { mode });
    return NextResponse.json(summary);
  } catch (error) {
    return jsonError("Erreur lors de l'import des données", error, 400);
  }
}
