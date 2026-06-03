import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listCategories } from "@/lib/budget/budget-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim();
    const type = request.nextUrl.searchParams.get("type");
    let categories = await listCategories();
    if (type) categories = categories.filter((entry) => entry.type === type);
    const items = categories
      .filter((entry) => (q ? entry.name.toLowerCase().includes(q) : true))
      .slice(0, 30)
      .map((entry) => ({ id: entry.id, label: entry.name, helper: entry.type }));
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplete catégories impossible", error);
  }
}
