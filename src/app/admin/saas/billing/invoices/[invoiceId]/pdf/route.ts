import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { getInvoice, readInvoiceFile } from "@/lib/saas/billing/invoice-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ invoiceId: string }> };

/** Sert le PDF de la facture. Superuser OU owner du tenant de la facture. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { invoiceId } = await params;
  const data = await getInvoice(invoiceId).catch(() => null);
  if (!data) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });

  const me = await getCurrentUser().catch(() => null);
  if (!me?.is_superuser) {
    const ctx = await getCurrentTenant().catch(() => null);
    if (!ctx || ctx.tenantId !== String(data.invoice.tenant_id)) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
  }
  const buf = await readInvoiceFile(data.invoice, "pdf");
  if (!buf) return NextResponse.json({ error: "PDF indisponible (facture non émise ?)." }, { status: 404 });
  const number = (data.invoice.invoice_number as string) ?? invoiceId;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${number}.pdf"`,
    },
  });
}
