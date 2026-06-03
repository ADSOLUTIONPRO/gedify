import type { NextRequest } from "next/server";
import { proxyCollectionGet } from "@/lib/paperless-route-handlers";

const endpoint = "/api/statistics/";
const label = "les statistiques Gedify";

export async function GET(request: NextRequest) {
  return proxyCollectionGet(request, endpoint, { label });
}
