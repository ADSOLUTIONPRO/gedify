import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { readSession } from "@/lib/auth/session";
import {
  createDocumentNote,
  listDocumentNotes,
  type DocumentNoteNature,
} from "@/lib/documents/document-notes-store";
import { appendGedLog } from "@/lib/ged/ged-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const documentId = Number.parseInt(id, 10);
    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "Identifiant de document invalide." }, { status: 400 });
    }
    const notes = await listDocumentNotes(documentId);
    return NextResponse.json({ notes });
  } catch (error) {
    return jsonError("Liste des notes du document impossible", error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const documentId = Number.parseInt(id, 10);
    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "Identifiant de document invalide." }, { status: 400 });
    }

    const body = (await request.json()) as { content?: string; nature?: DocumentNoteNature; noteDate?: string };
    if (!body.content?.trim()) {
      return NextResponse.json({ error: "Le contenu de la note est obligatoire." }, { status: 400 });
    }

    const session = await readSession();
    const note = await createDocumentNote(documentId, {
      content: body.content,
      nature: body.nature,
      noteDate: body.noteDate,
      author: session?.username ?? null,
    });

    await appendGedLog({
      level: "info",
      source: "GED",
      message: `Note ajoutée (${note.nature}) — ${session?.username ?? "système"}`,
      documentId,
      user: session?.username ?? null,
    }).catch(() => {});

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return jsonError("Ajout de la note impossible", error);
  }
}
