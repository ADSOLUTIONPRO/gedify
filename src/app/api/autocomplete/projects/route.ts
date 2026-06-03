import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim();
    // Lazy import: the projects module may or may not exist depending on setup.
    type Folder = { id: string; name: string; parentId?: string | null; status?: string };
    let projects: Folder[] = [];
    try {
      const mod = (await import("@/lib/projects/project-store")) as {
        listProjectFolders?: () => Promise<Folder[]>;
      };
      if (mod.listProjectFolders) {
        projects = await mod.listProjectFolders();
      }
    } catch {
      projects = [];
    }
    // Libellé = chemin complet « A / B / C » pour distinguer les sous-dossiers.
    const byId = new Map(projects.map((p) => [p.id, p]));
    function fullPath(p: Folder): string {
      const names: string[] = [];
      const seen = new Set<string>();
      let cur: Folder | undefined = p;
      while (cur && !seen.has(cur.id)) {
        names.unshift(cur.name);
        seen.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      return names.join(" / ");
    }
    const items = projects
      .map((entry) => ({ id: entry.id, label: fullPath(entry), helper: entry.status }))
      .filter((entry) => (q ? entry.label.toLowerCase().includes(q) : true))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"))
      .slice(0, 40);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplete dossiers impossible", error);
  }
}
