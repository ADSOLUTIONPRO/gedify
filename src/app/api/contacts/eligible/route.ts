import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { computeEligibleContacts } from "@/lib/contacts/eligible-contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/eligible — contacts éligibles à la règle métier GEDify
 * (liés à un email non masqué dont une PJ est réellement importée en GED).
 *   ?q=recherche  ?sort=name|emails|docs|recent  ?page=1  ?pageSize=50
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const sort = sp.get("sort") ?? "name";
    const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(200, Math.max(1, Number.parseInt(sp.get("pageSize") ?? "50", 10) || 50));

    const { contacts, report } = await computeEligibleContacts();

    let items = q
      ? contacts.filter((c) => `${c.displayName} ${c.email} ${c.company ?? ""}`.toLowerCase().includes(q))
      : contacts;

    items = [...items].sort((a, b) => {
      switch (sort) {
        case "emails": return b.linkedEmailsCount - a.linkedEmailsCount || a.displayName.localeCompare(b.displayName, "fr");
        case "docs": return b.linkedGedDocumentsCount - a.linkedGedDocumentsCount || a.displayName.localeCompare(b.displayName, "fr");
        case "recent": return (b.lastInteractionAt ?? "").localeCompare(a.lastInteractionAt ?? "");
        default: return a.displayName.localeCompare(b.displayName, "fr");
      }
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return NextResponse.json({ items: paged, total, page, pageSize, report });
  } catch (error) {
    return jsonError("Calcul des contacts éligibles impossible", error);
  }
}
