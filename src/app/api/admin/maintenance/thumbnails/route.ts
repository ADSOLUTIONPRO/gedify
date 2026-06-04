import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import {
  readStore,
  readOriginal,
  saveThumbnail,
  thumbnailExists,
  STORE,
  type EngineDocument,
} from "@/lib/engine/stores";
import { makeThumbnail } from "@/lib/engine/thumbnails";

/* ────────────────────────────────────────────────────────────────────────
   Maintenance des miniatures (Chantier 3) — rattrapage des documents existants
   dont la vignette est absente (ou à régénérer). Génère côté serveur (sharp +
   pdfjs/canvas) et met en cache sur disque. NE modifie JAMAIS l'original.

   GET  → statistiques (total / avec miniature / manquantes).
   POST → { action: "generate-missing" | "regenerate-all", limit?: number }
          traite par lot (limit, défaut 300) et renvoie le reste à traiter,
          pour pouvoir relancer jusqu'à épuisement sans timeout.
   ──────────────────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_LIMIT = 300;

async function activeDocuments(): Promise<EngineDocument[]> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  return docs.filter((d) => !d.deleted);
}

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  try {
    const docs = await activeDocuments();
    let withThumbnail = 0;
    for (const d of docs) {
      if (await thumbnailExists(d.id)) withThumbnail += 1;
    }
    return NextResponse.json({
      total: docs.length,
      withThumbnail,
      missing: docs.length - withThumbnail,
    });
  } catch (error) {
    return jsonError("Impossible de calculer l'état des miniatures", error);
  }
}

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: { action?: string; limit?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* corps vide → valeurs par défaut */
  }

  const action = body.action === "regenerate-all" ? "regenerate-all" : "generate-missing";
  const limit =
    Number.isFinite(body.limit) && (body.limit as number) > 0
      ? Math.min(Math.floor(body.limit as number), 2000)
      : DEFAULT_LIMIT;

  try {
    const docs = await activeDocuments();

    // Sélection des candidats (régénération forcée OU miniature manquante).
    const candidates: EngineDocument[] = [];
    for (const d of docs) {
      if (action === "regenerate-all" || !(await thumbnailExists(d.id))) {
        candidates.push(d);
      }
    }

    const batch = candidates.slice(0, limit);
    let generated = 0;
    let failed = 0;
    for (const d of batch) {
      try {
        const orig = await readOriginal(d.storedFilename);
        if (!orig) {
          failed += 1;
          continue;
        }
        const thumb = await makeThumbnail(orig, d.mime_type ?? "", path.extname(d.storedFilename));
        await saveThumbnail(d.id, thumb);
        generated += 1;
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({
      action,
      processed: batch.length,
      generated,
      failed,
      remaining: Math.max(0, candidates.length - batch.length),
    });
  } catch (error) {
    return jsonError("Échec de la régénération des miniatures", error);
  }
}
