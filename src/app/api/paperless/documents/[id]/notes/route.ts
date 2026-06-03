import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";
import type { PaperlessNote } from "@/lib/paperless-types";

type NotesRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: NotesRouteContext) {
  try {
    const { id } = await params;
    const data = await paperlessFetch<PaperlessNote[]>(`/api/documents/${id}/notes/`);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de récupérer les notes Gedify", error);
  }
}

export async function POST(request: NextRequest, { params }: NotesRouteContext) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as { note?: string };

    if (!payload.note?.trim()) {
      return NextResponse.json({ error: "La note est obligatoire." }, { status: 400 });
    }

    const data = await paperlessFetch<PaperlessNote[]>(`/api/documents/${id}/notes/`, {
      method: "POST",
      body: { note: payload.note.trim() },
    });

    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible d'ajouter la note Gedify", error);
  }
}

export async function DELETE(request: NextRequest, { params }: NotesRouteContext) {
  try {
    const { id } = await params;
    const noteId = request.nextUrl.searchParams.get("id");

    if (!noteId) {
      return NextResponse.json({ error: "Identifiant de note obligatoire." }, { status: 400 });
    }

    const data = await paperlessFetch<PaperlessNote[]>(`/api/documents/${id}/notes/`, {
      method: "DELETE",
      searchParams: { id: noteId },
    });

    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de supprimer la note Gedify", error);
  }
}
