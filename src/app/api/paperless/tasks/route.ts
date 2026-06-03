import type { NextRequest } from "next/server";
import { proxyCollectionGet, proxyCollectionPost } from "@/lib/paperless-route-handlers";

const endpoint = "/api/tasks/";
const label = "les tâches Gedify";

export async function GET(request: NextRequest) {
  return proxyCollectionGet(request, endpoint, { label });
}

export async function POST(request: NextRequest) {
  return proxyCollectionPost(request, endpoint, { label });
}
