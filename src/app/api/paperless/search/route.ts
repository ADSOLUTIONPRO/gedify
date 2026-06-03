import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getDocuments } from "@/lib/paperless";

export async function GET(request: NextRequest) {
  try {
    const data = await getDocuments(request.nextUrl.searchParams);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible d'exécuter la recherche Gedify", error);
  }
}
