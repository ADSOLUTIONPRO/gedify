import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { addLink, listLinkedIds, removeLink } from "@/lib/documents/document-links-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function resolve(req: NextRequest, params: Ctx["params"]) {
  const deny = await requireAuth(req);
  if (deny) return { deny } as const;
  const user = await getCurrentUser();
  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId) || documentId <= 0) {
    return { error: NextResponse.json({ error: "documentId invalide." }, { status: 400 }) } as const;
  }
  return { userId: user ? String(user.id) : "local", documentId } as const;
}

/** GET /api/documents/:id/links — ids des documents liés. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const r = await resolve(req, params);
  if ("deny" in r) return r.deny;
  if ("error" in r) return r.error;
  try {
    const ids = await listLinkedIds(r.userId, r.documentId);
    return NextResponse.json({ ids });
  } catch (error) {
    return jsonError("Documents liés indisponibles.", error);
  }
}

/** POST /api/documents/:id/links { targetId } — lie deux documents. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await resolve(req, params);
  if ("deny" in r) return r.deny;
  if ("error" in r) return r.error;
  try {
    const body = (await req.json().catch(() => ({}))) as { targetId?: number };
    const targetId = Number(body.targetId);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "targetId invalide." }, { status: 400 });
    }
    await addLink(r.userId, r.documentId, targetId);
    return NextResponse.json({ linked: true });
  } catch (error) {
    return jsonError("Liaison impossible.", error);
  }
}

/** DELETE /api/documents/:id/links?targetId= — retire le lien. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const r = await resolve(req, params);
  if ("deny" in r) return r.deny;
  if ("error" in r) return r.error;
  try {
    const targetId = Number(req.nextUrl.searchParams.get("targetId"));
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "targetId invalide." }, { status: 400 });
    }
    await removeLink(r.userId, r.documentId, targetId);
    return NextResponse.json({ linked: false });
  } catch (error) {
    return jsonError("Suppression du lien impossible.", error);
  }
}
