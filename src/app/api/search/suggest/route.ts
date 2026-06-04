import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { readStore, STORE, type EngineDocument, type EngineNamed, type EngineTag } from "@/lib/engine/stores";

/* Autocomplétion de recherche : suggestions de documents (titres), tags,
   correspondants et types correspondant au préfixe saisi. Lecture seule. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type Suggestion = {
  kind: "document" | "tag" | "correspondent" | "document_type";
  label: string;
  value: string;
  id: number;
};

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    const [docs, tags, correspondents, types] = await Promise.all([
      readStore<EngineDocument[]>(STORE.documents, []),
      readStore<EngineTag[]>(STORE.tags, []),
      readStore<EngineNamed[]>(STORE.correspondents, []),
      readStore<EngineNamed[]>(STORE.document_types, []),
    ]);

    const out: Suggestion[] = [];
    for (const t of tags) {
      if ((t.name ?? "").toLowerCase().includes(q)) out.push({ kind: "tag", label: t.name, value: t.name, id: t.id });
      if (out.filter((s) => s.kind === "tag").length >= 5) break;
    }
    for (const c of correspondents) {
      if ((c.name ?? "").toLowerCase().includes(q)) out.push({ kind: "correspondent", label: c.name, value: c.name, id: c.id });
      if (out.filter((s) => s.kind === "correspondent").length >= 5) break;
    }
    for (const t of types) {
      if ((t.name ?? "").toLowerCase().includes(q)) out.push({ kind: "document_type", label: t.name, value: t.name, id: t.id });
      if (out.filter((s) => s.kind === "document_type").length >= 5) break;
    }
    let docCount = 0;
    for (const d of docs) {
      if (d.deleted) continue;
      if ((d.title ?? "").toLowerCase().includes(q)) {
        out.push({ kind: "document", label: d.title, value: d.title, id: d.id });
        if (++docCount >= 7) break;
      }
    }

    return NextResponse.json({ suggestions: out });
  } catch (error) {
    return jsonError("Impossible de calculer les suggestions", error);
  }
}
