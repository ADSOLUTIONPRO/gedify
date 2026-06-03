import type { NextRequest } from "next/server";
import { proxyDocumentJsonGet } from "@/lib/paperless-route-handlers";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  return proxyDocumentJsonGet(request, context, "metadata", {
    label: "les métadonnées techniques du document Gedify",
  });
}
