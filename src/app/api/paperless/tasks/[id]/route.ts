import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getPaperlessTaskById } from "@/lib/paperless/paperless-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const task = await getPaperlessTaskById(id);
    if (!task) {
      return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error) {
    return jsonError("Impossible de récupérer la tâche", error);
  }
}
