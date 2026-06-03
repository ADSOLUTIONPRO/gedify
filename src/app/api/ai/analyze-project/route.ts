import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Project synthesis is on the roadmap once the projects/folders module exposes its public
 * document list. The provider is wired but returns a 'not connected yet' marker so the UI can
 * display a clear status.
 */
export async function POST() {
  try {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        message:
          "Synthèse de dossier IA à connecter — utilisez en attendant l'analyse document par document.",
      },
      { status: 200 },
    );
  } catch (error) {
    return jsonError("Synthèse impossible", error);
  }
}
