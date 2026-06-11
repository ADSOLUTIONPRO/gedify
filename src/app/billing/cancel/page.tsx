import Link from "next/link";
import { XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default function BillingCancelPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 text-center">
      <XCircle className="h-12 w-12 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
      <h1 className="mt-4 text-[20px] font-extrabold" style={{ color: "var(--text-main)" }}>Paiement annulé</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-muted)" }}>
        Aucun montant n&apos;a été débité. Vous pouvez réessayer à tout moment.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/pricing" className="inline-flex h-11 items-center rounded-xl border px-5 text-[14px] font-semibold" style={{ borderColor: "var(--border)" }}>Voir les offres</Link>
        <Link href="/admin/saas/tenant" className="inline-flex h-11 items-center rounded-xl px-5 text-[14px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Mon espace</Link>
      </div>
    </main>
  );
}
