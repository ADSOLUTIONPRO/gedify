import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { listProjectFolders } from "@/lib/projects/project-store";
import { applyProjectPaperlessTag } from "@/lib/projects/project-paperless-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Récupération : réapplique le tag Gedify « Dossier - … » de chaque dossier à
 * ses documents liés (`linkedDocumentIds`). Restaure le classement VISIBLE après
 * un vidage de tags accidentel — le classement GED (listes internes) restant intact.
 *
 * Idempotent et NON destructif : n'ajoute que des tags, n'en retire jamais.
 * Accessible en GET pour pouvoir simplement ouvrir l'URL une fois connecté.
 */
async function resync(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const projects = await listProjectFolders();
  const report: { folder: string; documents: number; tagId: number | null }[] = [];

  for (const project of projects) {
    const docIds = project.linkedDocumentIds ?? [];
    if (docIds.length === 0) continue;
    if (!project.paperlessTagId && !project.syncWithPaperlessTag) continue; // jamais synchronisé → on n'invente pas de tag
    try {
      const synced = await applyProjectPaperlessTag(project, docIds);
      report.push({ folder: project.name, documents: docIds.length, tagId: synced?.paperlessTagId ?? null });
    } catch (err) {
      report.push({ folder: project.name, documents: docIds.length, tagId: null });
      console.error(`[resync-tags] ${project.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return NextResponse.json({ ok: true, foldersResynced: report.length, report });
}

export async function POST(request: NextRequest) {
  return resync(request);
}
export async function GET(request: NextRequest) {
  return resync(request);
}
