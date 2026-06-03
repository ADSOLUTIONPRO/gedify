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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête multipart attendue (champ « file »)." }, { status: 400 });
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
