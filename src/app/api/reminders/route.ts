import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createReminder, listReminders, type ListReminderOptions, type ReminderInput } from "@/lib/actions/reminder-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const options: ListReminderOptions = {};
    const status = sp.get("status");
    if (status === "scheduled" || status === "done" || status === "cancelled") options.status = status;
    if (sp.get("recurring") === "1") options.recurringOnly = true;
    const documentId = sp.get("documentId");
    if (documentId) {
      const n = Number.parseInt(documentId, 10);
      if (Number.isFinite(n)) options.documentId = n;
    }
    const items = await listReminders(options);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Liste des rappels impossible", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReminderInput;
    if (!body.title || !body.remindAt) {
      return NextResponse.json({ error: "title et remindAt requis." }, { status: 400 });
    }
    const item = await createReminder(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Création du rappel impossible", error);
  }
}
