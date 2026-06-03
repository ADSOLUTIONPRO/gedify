import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { Banknote, CreditCard, Landmark, PiggyBank, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comptes — Finances" };

const ACCOUNTS = [
  { name: "Compte courant", icon: Landmark, color: "#0B5CFF" },
  { name: "Épargne", icon: PiggyBank, color: "#16A34A" },
  { name: "Carte", icon: CreditCard, color: "#7C3AED" },
  { name: "Espèces", icon: Banknote, color: "#F59E0B" },
];

export default function FinancesComptesPage() {
  return (
    <SpaceLayout spaceId="finances">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-muted)" }}>
        Comptes de paiement manuels utilisés lors de l&apos;enregistrement des paiements.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACCOUNTS.map((a) => {
          const Icon = a.icon;
          return (
            <div key={a.name} className="flex flex-col rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: `${a.color}14`, color: a.color }}>
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="mt-3 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{a.name}</span>
              <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Compte manuel</span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "rgba(11,92,255,0.04)" }}>
        <Wallet className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#0B5CFF" }} strokeWidth={1.75} aria-hidden="true" />
        <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-main)" }}>Connexion bancaire à venir.</strong> Le rapprochement
          automatique des transactions bancaires avec vos documents et lignes budget n&apos;est pas encore activé —
          les comptes ci-dessus restent des comptes de saisie manuelle.
        </p>
      </div>
    </SpaceLayout>
  );
}
