import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { pgStorageActive, postgresActive, sqliteActive, jsonFallback, pgReadAll } from "@/lib/db/pg-store";
import { listProjectFolders } from "@/lib/projects/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FolderSample = { id: unknown; name: unknown; linkedDocs: number | null };
type ReadResult = { ok: boolean; count?: number; sample?: FolderSample[]; error?: string };

/**
 * GET /api/projects/diagnostic — état RÉEL de la lecture des dossiers, pour
 * diagnostiquer « aucun dossier reconnu » sans accès direct à la base. Ne
 * renvoie AUCUN secret (présence de DATABASE_URL uniquement).
 */
export async function GET(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;

  const sampleOf = (rows: unknown[]): FolderSample[] =>
    rows.slice(0, 3).map((r) => {
      const f = (r ?? {}) as { id?: unknown; name?: unknown; linkedDocumentIds?: unknown };
      return { id: f.id ?? null, name: f.name ?? null, linkedDocs: Array.isArray(f.linkedDocumentIds) ? f.linkedDocumentIds.length : null };
    });

  let pgReadFolders: ReadResult;
  try {
    const rows = await pgReadAll<unknown>("folders");
    pgReadFolders = { ok: true, count: rows.length, sample: sampleOf(rows) };
  } catch (e) {
    pgReadFolders = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  let appPath: ReadResult;
  try {
    const folders = await listProjectFolders();
    appPath = { ok: true, count: folders.length, sample: sampleOf(folders) };
  } catch (e) {
    appPath = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({
    env: {
      GEDIFY_STORAGE_MODE: process.env.GEDIFY_STORAGE_MODE ?? null,
      PROJECT_STORE_TYPE: process.env.PROJECT_STORE_TYPE ?? null,
      DATABASE_URL_present: Boolean(process.env.DATABASE_URL),
      ENABLE_JSON_FALLBACK: process.env.ENABLE_JSON_FALLBACK ?? null,
    },
    flags: { pgStorageActive: pgStorageActive(), postgresActive: postgresActive(), sqliteActive: sqliteActive(), jsonFallback: jsonFallback() },
    pgReadFolders,    // lecture directe de la table Postgres "folders"
    listProjectFolders: appPath, // chemin réel utilisé par l'app (Fiche Doc, sélecteur…)
  });
}
