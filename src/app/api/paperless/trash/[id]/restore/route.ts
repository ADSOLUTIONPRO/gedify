import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";

type TrashContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, { params }: TrashContext) {
  try {
    const { id } = await params;
    const data = await paperlessFetch<unknown>("/api/trash/", {
      method: "POST",
      body: {
        action: "restore",
        documents: [Number(id)],
      },
    });

    return NextResponse.json(data ?? { ok: true });
  } catch (error) {
    return jsonError("Impossible de restaurer le document depuis la corbeille Gedify", error);
  }
}
