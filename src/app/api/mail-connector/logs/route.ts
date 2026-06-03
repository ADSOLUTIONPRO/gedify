import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listLogs } from "@/lib/mail-connector/log-store";
import type { MailSyncLog } from "@/lib/mail-connector/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: MailSyncLog["status"][] = [
  "imported",
  "ignored",
  "error",
  "duplicate",
  "pending",
];

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const accountId = url.searchParams.get("accountId") ?? undefined;
    const statusParam = url.searchParams.get("status");
    const status = STATUSES.includes(statusParam as MailSyncLog["status"])
      ? (statusParam as MailSyncLog["status"])
      : undefined;
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(500, Number.parseInt(limitRaw, 10)) : 100;
    const logs = await listLogs({ accountId, status, limit });
    return NextResponse.json({ logs });
  } catch (error) {
    return jsonError("Impossible de lister les logs", error);
  }
}
