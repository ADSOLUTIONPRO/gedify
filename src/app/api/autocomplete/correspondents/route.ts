import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getCorrespondents } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim();
    const data = await getCorrespondents();
    const items = (data.results ?? [])
      .filter((entry) => (q ? entry.name.toLowerCase().includes(q) : true))
      .slice(0, 20)
      .map((entry) => ({ id: entry.id, label: entry.name, helper: undefined }));
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplete correspondants impossible", error);
  }
}
