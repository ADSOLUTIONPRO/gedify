import type { NextRequest } from "next/server";
import { proxyDocumentFileGet } from "@/lib/paperless-route-handlers";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  return proxyDocumentFileGet(request, context, "preview", {
    label: "l'aperçu du document Gedify",
  });
}
