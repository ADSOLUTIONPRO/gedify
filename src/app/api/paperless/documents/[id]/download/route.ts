import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetchRaw } from "@/lib/paperless";

type DownloadRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: DownloadRouteContext) {
  try {
    const { id } = await params;
    const response = await paperlessFetchRaw(`/api/documents/${id}/download/`, {
      headers: {
        Accept: "application/pdf,application/octet-stream,*/*",
      },
    });

    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    const contentDisposition = response.headers.get("content-disposition");

    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    }

    headers.set("Cache-Control", "private, no-store");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return jsonError("Impossible de télécharger le document Gedify", error);
  }
}
