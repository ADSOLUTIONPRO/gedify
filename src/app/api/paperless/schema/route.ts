import type { NextRequest } from "next/server";
import { proxyCollectionGet } from "@/lib/paperless-route-handlers";

export async function GET(request: NextRequest) {
  return proxyCollectionGet(request, "/api/schema/", { label: "le schéma API du moteur" });
}
