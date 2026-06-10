import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    available: true,
    generationEndpoint: "/api/profile/generate_auth_token/",
    note: "Gedify ne renvoie jamais le token serveur PAPERLESS_TOKEN. La génération volontaire de token utilisateur est préparée mais non activée dans l'interface.",
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Génération de token non activée",
      details:
        "Gedify expose /api/profile/generate_auth_token/, mais cette action est volontairement désactivée dans cette passe pour éviter de régénérer un token sans confirmation explicite.",
    },
    { status: 501 }
  );
}
