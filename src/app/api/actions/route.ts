import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createAction, listActions } from "@/lib/actions/action-store";
import type {
  ActionItemInput,
  ActionPriority,
  ActionStatus,
  ActionType,
} from "@/lib/actions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const status = (url.searchParams.get("status") as ActionStatus | "todo-and-overdue" | "open" | null) ?? undefined;
    const priority = (url.searchParams.get("priority") as ActionPriority | null) ?? undefined;
    const type = (url.searchParams.get("type") as ActionType | null) ?? undefined;
    const docIdRaw = url.searchParams.get("documentId");
    const documentId = docIdRaw ? Number.parseInt(docIdRaw, 10) : undefined;
    const items = await listActions({ status, priority, type, documentId });
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de lister les actions", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActionItemInput;
    const item = await createAction(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer l'action", error);
  }
}
