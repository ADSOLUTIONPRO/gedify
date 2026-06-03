import type { NextRequest } from "next/server";
import { proxyCollectionGet } from "@/lib/paperless-route-handlers";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";
import type { PaperlessProfile } from "@/lib/paperless-types";

export async function GET(request: NextRequest) {
  return proxyCollectionGet(request, "/api/profile/", { label: "le profil Gedify" });
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const data = await paperlessFetch<PaperlessProfile>("/api/profile/", {
      method: "PATCH",
      body: payload,
    });

    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de modifier le profil Gedify", error);
  }
}
