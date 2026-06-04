import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/current-user";
import { jsonError } from "@/lib/api-utils";
import {
  readStore,
  readOriginal,
  savePreview,
  previewExists,
  STORE,
  type EngineDocument,
} from "@/lib/engine/stores";
import { makePreview } from "@/lib/engine/previews";

/* Maintenance des aperçus (Chantier 3) — rattrapage des documents existants sans
   aperçu moyenne résolution. Génère côté serveur (sharp + pdfjs/canvas) et met en
   cache sur disque (files/previews). Ne modifie jamais l'original.

   GET  → { total, withPreview, missing }
   POST → { action: "generate-missing" | "regenerate-all", limit?: number } */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_LIMIT = 200;

async function activeDocuments(): Promise<EngineDocument[]> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  return docs.filter((d) => !d.deleted);
}

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  try {
    const docs = await activeDocuments();
    let withPreview = 0;
    for (const d of docs) {
      if (await previewExists(d.id)) withPreview += 1;
    }
    return NextResponse.json({ total: docs.length, withPreview, missing: docs.length - withPreview });
  } catch (error) {
    return jsonError("Impossible de calculer l'état des aperçus", error);
  }
}

export async function POST(request: NextRequest) {
  const deny = await requirePermission(request, "admin.access");
  if (deny) return deny;

  let body: { action?: string; limit?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* corps vide → défauts */
  }

  const action = body.action === "regenerate-all" ? "regenerate-all" : "generate-missing";
  const limit =
    Number.isFinite(body.limit) && (body.limit as number) > 0
      ? Math.min(Math.floor(body.limit as number), 2000)
      : DEFAULT_LIMIT;

  try {
    const docs = await activeDocuments();
    const candidates: EngineDocument[] = [];
    for (const d of docs) {
      if (action === "regenerate-all" || !(await previewExists(d.id))) candidates.push(d);
    }

    const batch = candidates.slice(0, limit);
    let generated = 0;
    let failed = 0;
    let skipped = 0;
    for (const d of batch) {
      try {
        const orig = await readOriginal(d.storedFilename);
        if (!orig) {
          failed += 1;
          continue;
        }
        const made = await makePreview(orig, d.mime_type ?? "", path.extname(d.storedFilename));
        if (made) {
          await savePreview(d.id, made);
          generated += 1;
        } else {
          skipped += 1; // type sans aperçu image
        }
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({
      action,
      processed: batch.length,
      generated,
      skipped,
      failed,
      remaining: Math.max(0, candidates.length - batch.length),
    });
  } catch (error) {
    return jsonError("Échec de la régénération des aperçus", error);
  }
}
