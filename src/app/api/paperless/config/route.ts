import type { NextRequest } from "next/server";
import { proxyCollectionGet } from "@/lib/paperless-route-handlers";

const endpoint = "/api/config/";
const label = "la configuration Gedify";

export async function GET(request: NextRequest) {
  return proxyCollectionGet(request, endpoint, { label });
}
