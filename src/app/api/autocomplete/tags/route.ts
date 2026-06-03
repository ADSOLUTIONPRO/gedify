import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getTags } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim();
    const data = await getTags();
    const items = (data.results ?? [])
      .filter((entry) => (q ? entry.name.toLowerCase().includes(q) : true))
      .slice(0, 30)
      .map((entry) => ({
        id: entry.id,
        label: entry.name,
        helper: entry.color ? `couleur ${entry.color}` : undefined,
      }));
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplete tags impossible", error);
  }
}
