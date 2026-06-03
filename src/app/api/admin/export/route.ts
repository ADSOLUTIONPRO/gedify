import "server-only";

import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { buildExportZip } from "@/lib/transfer/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Export complet (documents + fichiers) : peut être long sur de gros volumes.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const includeFiles = request.nextUrl.searchParams.get("files") !== "false";

  try {
    const { buffer, filename, counts, errors } = await buildExportZip({ includeFiles });
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Export-Counts": JSON.stringify(counts),
        "X-Export-Errors": String(errors.length),
      },
    });
  } catch (error) {
    return jsonError("Erreur lors de l'export des données", error);
  }
}
