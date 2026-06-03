import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getDocuments, paperlessFetch } from "@/lib/paperless";

export async function GET(request: NextRequest) {
  try {
    const data = await getDocuments(request.nextUrl.searchParams);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de récupérer les documents Gedify", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const data = await paperlessFetch<unknown>("/api/documents/post_document/", {
      method: "POST",
      body: formData,
    });

    return NextResponse.json({ ok: true, task: data });
  } catch (error) {
    return jsonError("Impossible d'envoyer le document à Gedify", error);
  }
}
