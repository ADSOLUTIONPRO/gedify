import Link from "next/link";
import { CheckCircle2, RefreshCw, Settings } from "lucide-react";

type GmailConnectionStatusProps = {
  email: string;
  connectedAt: string;
};

/** Bandeau de statut Gmail connecté (compte + actions synchroniser / paramètres). */
export function GmailConnectionStatus({ email, connectedAt }: GmailConnectionStatusProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "rgba(219,39,119,0.04)" }}>
      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#16A34A" }} strokeWidth={1.75} aria-hidden="true" />
      <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        Gmail connecté : <strong style={{ color: "var(--text-main)" }}>{email}</strong> · depuis le {new Date(connectedAt).toLocaleDateString("fr-FR")}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <Link href="/messagerie/parametres" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Synchroniser
        </Link>
        <Link href="/messagerie/parametres" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <Settings className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Paramètres
        </Link>
      </span>
    </div>
  );
}
