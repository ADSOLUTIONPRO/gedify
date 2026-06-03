import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { readSession } from "@/lib/auth/session";
import { getTags, paperlessFetch, updatePaperlessObject } from "@/lib/paperless";
import type { PaperlessDocument, PaperlessListResponse } from "@/lib/paperless-types";
import { appendGedLog } from "@/lib/ged/ged-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERMIS = /permis\s+de\s+conduire/i;

/** Tous les IDs de documents portant un tag donné (pagination Gedify). */
async function documentIdsWithTag(tagId: number): Promise<number[]> {
  const ids: number[] = [];
  let page = 1;
  // Borne de sécurité : 200 pages × 250 = 50 000 docs.
  for (let i = 0; i < 200; i++) {
    const res = await paperlessFetch<PaperlessListResponse<PaperlessDocument>>("/api/documents/", {
      searchParams: { tags__id__all: tagId, page, page_size: 250, fields: "id" },
    });
    for (const d of res.results ?? []) ids.push(Number(d.id));
    if (!res.next) break;
    page += 1;
  }
  return ids;
}

/**
 * Nettoyage du tag « Permis de conduire » appliqué à tort en masse (auto-matching
 * Gedify). Désactive l'auto-matching du/des tag(s) et retire le tag de tous
 * les documents qui le portent.
 */
export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  try {
    const tags = (await getTags({ page_size: 1000 })).results ?? [];
    const targets = tags.filter((t) => PERMIS.test(t.name));
    if (targets.length === 0) {
      return NextResponse.json({ ok: true, tagsFound: 0, documentsCleaned: 0, message: "Aucun tag « Permis de conduire » trouvé." });
    }

    let documentsCleaned = 0;
    const details: { tag: string; matchDisabled: boolean; documents: number }[] = [];

    for (const tag of targets) {
      // 1) Désactiver l'auto-matching (algorithm 0 = aucun) pour stopper la repose.
      let matchDisabled = false;
      try {
        await updatePaperlessObject("/api/tags/", tag.id, { matching_algorithm: 0, match: "" });
        matchDisabled = true;
      } catch {
        /* on continue le retrait même si la MAJ du tag échoue */
      }

      // 2) Retirer le tag de tous les documents qui le portent.
      const docIds = await documentIdsWithTag(Number(tag.id));
      if (docIds.length > 0) {
        // Gedify borne la taille des lots de bulk_edit → on découpe.
        for (let i = 0; i < docIds.length; i += 100) {
          const batch = docIds.slice(i, i + 100);
          await paperlessFetch("/api/documents/bulk_edit/", {
            method: "POST",
            body: { documents: batch, method: "modify_tags", parameters: { add_tags: [], remove_tags: [tag.id] } },
          });
        }
        documentsCleaned += docIds.length;
      }
      details.push({ tag: tag.name, matchDisabled, documents: docIds.length });
    }

    const session = await readSession();
    await appendGedLog({
      level: "success",
      source: "GED",
      message: `Nettoyage tag « Permis de conduire » — ${documentsCleaned} document(s) — ${session?.username ?? "système"}`,
      details: JSON.stringify(details),
      user: session?.username ?? null,
    }).catch(() => {});

    return NextResponse.json({ ok: true, tagsFound: targets.length, documentsCleaned, details });
  } catch (error) {
    return jsonError("Nettoyage du tag « Permis de conduire » impossible", error);
  }
}
