import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function BillingSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 text-center">
      <CheckCircle2 className="h-12 w-12 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
      <h1 className="mt-4 text-[20px] font-extrabold" style={{ color: "var(--text-main)" }}>Paiement confirmé</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-muted)" }}>
        Merci ! Votre abonnement est en cours d&apos;activation. L&apos;état se met à jour
        automatiquement (webhook Stripe) sous quelques instants.
      </p>
      <Link href="/admin/saas/tenant" className="mt-6 inline-flex h-11 items-center rounded-xl px-5 text-[14px] font-bold text-white" style={{ background: "var(--blue-600)" }}>
        Voir mon espace
      </Link>
    </main>
  );
}
