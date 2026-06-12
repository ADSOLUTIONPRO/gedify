import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvoiceTemplate, renderInvoiceTemplatePreview, renderInvoiceTemplatePreviewPdf } from "@/lib/saas/billing/invoice-template-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aperçu d'un modèle de facture (données fictives, superuser). HTML ou PDF. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const me = await getCurrentUser().catch(() => null);
  if (!me?.is_superuser) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { templateId } = await params;
  const template = await getInvoiceTemplate(templateId);
  if (!template) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });

  if (req.nextUrl.searchParams.get("format") === "pdf") {
    const pdf = await renderInvoiceTemplatePreviewPdf(template);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="apercu-${templateId}.pdf"` } });
  }
  const html = await renderInvoiceTemplatePreview(template);
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
