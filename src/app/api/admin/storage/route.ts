import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { collectStorageDiagnostic } from "@/lib/startup/storage-diagnostic";

/* Diagnostic de persistance (lecture seule, AUCUNE valeur secrète renvoyée).
   Alimente un contrôle rapide « ma base est-elle bien trouvée ? » côté admin. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const d = await collectStorageDiagnostic();
    return NextResponse.json({
      runtime: d.runtime,
      storageMode: d.storageMode,
      dataDir: d.dataDir,
      dataDirWritable: d.dataDirWritable,
      databasePath: d.databasePath,
      databaseExists: d.databaseExists,
      databaseWritable: d.databaseWritable,
      databaseSize: d.databaseSize,
      walSize: d.walSize,
      appliedMigrations: d.appliedMigrations,
      usersCount: d.usersCount,
      dataPresent: d.dataPresent,
      legacyDbFiles: d.legacyDbFiles,
      secretsFileExists: d.secretsFileExists,
      // Présence uniquement — jamais les valeurs.
      authSecretPresent: d.secretsPresent.AUTH_SECRET ?? false,
      sessionSecretPresent: d.secretsPresent.SESSION_SECRET ?? false,
      secretsPresent: d.secretsPresent,
      anomaly: d.anomaly,
      anomalyReason: d.anomalyReason,
    });
  } catch (error) {
    return jsonError("Diagnostic de stockage impossible", error);
  }
}
