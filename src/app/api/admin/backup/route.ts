import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { createServerBackup, listServerBackups } from "@/lib/transfer/backup";

/* Sauvegarde serveur « maintenant » : GET liste les archives, POST en crée une
   nouvelle (documents + fichiers + dump PostgreSQL si actif) dans BACKUPS_DIR. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    return NextResponse.json({ backups: await listServerBackups() });
  } catch (error) {
    return jsonError("Impossible de lister les sauvegardes", error);
  }
}

/** Autorise un déclencheur externe (cron) via BACKUP_CRON_TOKEN, sinon session. */
function hasValidCronToken(request: NextRequest): boolean {
  const expected = process.env.BACKUP_CRON_TOKEN?.trim();
  if (!expected) return false;
  const provided =
    request.headers.get("x-backup-token")?.trim() ||
    request.nextUrl.searchParams.get("token")?.trim() ||
    "";
  return provided.length > 0 && provided === expected;
}

export async function POST(request: NextRequest) {
  if (!hasValidCronToken(request)) {
    const deny = await requireAuth(request);
    if (deny) return deny;
  }

  let body: { includeFiles?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* corps vide → défauts */
  }

  try {
    const report = await createServerBackup({ includeFiles: body.includeFiles });
    return NextResponse.json(report);
  } catch (error) {
    return jsonError("Échec de la sauvegarde", error);
  }
}
