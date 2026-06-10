import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { addPin, removePin } from "@/lib/documents/pins-store";

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

/** POST /api/documents/:id/pin — épingle le document (par utilisateur). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await resolve(req, params);
  if ("deny" in r) return r.deny;
  if ("error" in r) return r.error;
  try {
    await addPin(r.userId, r.documentId);
    return NextResponse.json({ pinned: true });
  } catch (error) {
    return jsonError("Épinglage impossible.", error);
  }
}

/** DELETE /api/documents/:id/pin — détache le document. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const r = await resolve(req, params);
  if ("deny" in r) return r.deny;
  if ("error" in r) return r.error;
  try {
    await removePin(r.userId, r.documentId);
    return NextResponse.json({ pinned: false });
  } catch (error) {
    return jsonError("Détachement impossible.", error);
  }
}
