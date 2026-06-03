"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Plus, RefreshCw, Trash2 } from "lucide-react";

export type GmailAccountSummary = { accountId: string; email: string; connectedAt: string };

const RETURN_TO = "/messagerie/parametres";

/**
 * Gestion des comptes Gmail dans Mails > Paramètres : reconnecter (met à jour le
 * compte existant, pas de doublon), supprimer, ajouter un compte.
 */
export function GmailAccountsManager({ accounts }: { accounts: GmailAccountSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  function connect(accountId?: string) {
    const params = new URLSearchParams({ returnTo: RETURN_TO });
    if (accountId) params.set("accountId", accountId);
    window.location.assign(`/api/connectors/gmail/start?${params.toString()}`);
  }

  async function remove(accountId: string) {
    setBusy(accountId);
    try {
      await fetch("/api/connectors/gmail/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accountId, deleteAccount: true }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  // Repère les doublons (même email) pour aider à nettoyer.
  const counts = new Map<string, number>();
  accounts.forEach((a) => counts.set(a.email.toLowerCase(), (counts.get(a.email.toLowerCase()) ?? 0) + 1));

  return (
    <div className="space-y-3">
      {accounts.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun compte Gmail connecté.</p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a, i) => {
            const dup = (counts.get(a.email.toLowerCase()) ?? 0) > 1;
            return (
              <li key={a.accountId} className="flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "var(--accent)" }}>
                  {a.email[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>
                    {a.email}
                    {dup ? <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: "#FEF3C7", color: "#B45309" }}>doublon</span> : null}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Connecté le {new Date(a.connectedAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <button type="button" onClick={() => connect(a.accountId)} title="Reconnecter / mettre à jour" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} /> Reconnecter
                </button>
                <button type="button" onClick={() => void remove(a.accountId)} disabled={busy === a.accountId} title="Supprimer ce compte" className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-bold transition hover:bg-rose-50 disabled:opacity-50" style={{ borderColor: "#FECACA", color: "#B91C1C" }}>
                  {busy === a.accountId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  {i === 0 ? "Supprimer" : ""}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" onClick={() => connect()} className="inline-flex h-9 items-center gap-1.5 rounded-[20px] px-4 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
        <Plus className="h-4 w-4" strokeWidth={2.5} /> Ajouter un compte
      </button>
      <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-hint)" }}>
        <Mail className="h-3 w-3" strokeWidth={1.75} /> Reconnecter un compte déjà présent le met à jour sans créer de doublon.
      </p>
    </div>
  );
}
