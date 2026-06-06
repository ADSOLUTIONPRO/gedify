import { NextResponse } from "next/server";

/* Liveness PUBLIQUE (healthcheck Docker / Synology, reverse proxy). N'expose
   AUCUNE donnée sensible : statut + mode de déploiement uniquement. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    runtime: process.env.GEDIFY_RUNTIME ?? "web",
    storage: (process.env.GEDIFY_STORAGE_MODE ?? "json").toLowerCase(),
    time: new Date().toISOString(),
  });
}
