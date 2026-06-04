import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requirePermission } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit/audit-store";
import { jsonError } from "@/lib/api-utils";
import {
  readStore,
  STORE,
  thumbnailsDir,
  previewsDir,
  type EngineDocument,
} from "@/lib/engine/stores";
import { legacyMediaSubdir } from "@/lib/storage/ged-paths";

/* Nettoyage des fichiers dérivés ORPHELINS : miniatures / aperçus dont l'id ne
   correspond plus à aucun document actif. Ne touche jamais aux originaux ni aux
   documents. POST → supprime ; aucune confirmation côté serveur (le client
   confirme). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function activeIds(): Promise<Set<number>> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  return new Set(docs.filter((d) => !d.deleted).map((d) => d.id));
}

function webpId(name: string): number | null {
  const m = name.match(/^(\d+)\.webp$/);
  return m ? Number(m[1]) : null;
}

async function orphanFilesIn(dir: string, active: Set<number>): Promise<string[]> {
  let names: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    names = entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
  return names
    .filter((n) => {
      const id = webpId(n);
      return id != null && !active.has(id);
    })
    .map((n) => path.join(dir, n));
}

export async function POST(request: NextRequest) {
  const deny = await requirePermission(request, "admin.access");
  if (deny) return deny;

  try {
    const active = await activeIds();
    const targets = [
      ...(await orphanFilesIn(thumbnailsDir(), active)),
      ...(await orphanFilesIn(legacyMediaSubdir("thumbnails"), active)),
      ...(await orphanFilesIn(previewsDir(), active)),
    ];

    let deleted = 0;
    for (const file of targets) {
      try {
        await fs.rm(file, { force: true });
        deleted += 1;
      } catch {
        /* ignore */
      }
    }
    await recordAudit({ action: "maintenance.cleanup-orphans", details: `${deleted} fichier(s) supprimé(s)` });
    return NextResponse.json({ deleted, scanned: targets.length });
  } catch (error) {
    return jsonError("Échec du nettoyage des fichiers orphelins", error);
  }
}
