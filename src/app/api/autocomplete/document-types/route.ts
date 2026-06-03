import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getDocumentTypes } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim();
    const data = await getDocumentTypes();
    const items = (data.results ?? [])
      .filter((entry) => (q ? entry.name.toLowerCase().includes(q) : true))
      .slice(0, 30)
      .map((entry) => ({ id: entry.id, label: entry.name }));
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplete types impossible", error);
  }
}
