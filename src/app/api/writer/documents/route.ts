import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { generateInitialDocx, findTemplate } from "@/lib/writer/templates";
import {
  createWriterDocument,
  listWriterDocuments,
} from "@/lib/writer/writer-store";
import type { WriterDocumentInput } from "@/lib/writer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const documents = await listWriterDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    return jsonError("Impossible de lister les documents", error);
  }
}

type CreateInput = WriterDocumentInput & {
  city?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateInput;
    const template = body.templateId ? findTemplate(body.templateId) : null;
    const initialDocx = await generateInitialDocx({
      template,
      recipient: body.recipient,
      recipientAddress: body.recipientAddress,
      subject: body.subject,
      reference: body.reference,
      city: body.city,
    });
    const created = await createWriterDocument({ ...body, initialDocx });
    return NextResponse.json({ document: created }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer le document", error);
  }
}
