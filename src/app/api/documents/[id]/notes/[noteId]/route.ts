import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { readSession } from "@/lib/auth/session";
import {
  deleteDocumentNote,
  updateDocumentNote,
  type DocumentNoteNature,
} from "@/lib/documents/document-notes-store";
import { appendGedLog } from "@/lib/ged/ged-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id, noteId } = await params;
    const documentId = Number.parseInt(id, 10);
    const body = (await request.json()) as { content?: string; nature?: DocumentNoteNature; noteDate?: string };

    const note = await updateDocumentNote(noteId, {
      content: body.content,
      nature: body.nature,
      noteDate: body.noteDate,
    });
    if (!note) return NextResponse.json({ error: "Note introuvable." }, { status: 404 });

    const session = await readSession();
    await appendGedLog({
      level: "info",
      source: "GED",
      message: `Note modifiée — ${session?.username ?? "système"}`,
      documentId: Number.isFinite(documentId) ? documentId : null,
      user: session?.username ?? null,
    }).catch(() => {});

    return NextResponse.json({ note });
  } catch (error) {
    return jsonError("Modification de la note impossible", error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id, noteId } = await params;
    const documentId = Number.parseInt(id, 10);
    const ok = await deleteDocumentNote(noteId);
    if (!ok) return NextResponse.json({ error: "Note introuvable." }, { status: 404 });

    const session = await readSession();
    await appendGedLog({
      level: "info",
      source: "GED",
      message: `Note supprimée — ${session?.username ?? "système"}`,
      documentId: Number.isFinite(documentId) ? documentId : null,
      user: session?.username ?? null,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression de la note impossible", error);
  }
}
