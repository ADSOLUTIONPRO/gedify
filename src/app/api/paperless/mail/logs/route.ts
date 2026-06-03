import type { NextRequest } from "next/server";
import { proxyCollectionGet } from "@/lib/paperless-route-handlers";

const endpoint = "/api/processed_mail/";
const label = "les logs email Gedify";

export async function GET(request: NextRequest) {
  return proxyCollectionGet(request, endpoint, { label });
}
