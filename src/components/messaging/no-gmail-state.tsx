import Link from "next/link";
import { Mail, Sparkles, Server } from "lucide-react";

type NoGmailStateProps = {
  /** Conservé pour compat d'appel ; n'affiche plus d'info technique. */
  oauthConfigured?: boolean;
  /** Le compte existe mais sa session a expiré → reconnexion. */
  needsReconnect?: boolean;
};

/**
 * État « aucune boîte mail connectée » — NEUTRE (aucun fournisseur n'est présenté
 * comme prioritaire ou supérieur). Deux choix : Google ou autre boîte IMAP.
 * Aucune information technique (client_id, scope, redirect…) exposée à l'utilisateur.
 */
export function NoGmailState({ needsReconnect }: NoGmailStateProps) {
  return (
    <div
      className="rounded-2xl bg-white p-6"
      style={{ border: "1px solid var(--border)", boxShadow: "0 2px 16px -8px rgba(8,18,37,0.08)" }}
    >
      <div className="mx-auto max-w-xl text-center">
        <span
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(11,92,255,0.10)", color: "var(--blue-600)" }}
        >
          <Mail className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="text-base font-extrabold" style={{ color: "var(--text-main)" }}>
          {needsReconnect ? "Reconnectez votre boîte mail" : "Aucune boîte mail connectée"}
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {needsReconnect
            ? "Votre session a expiré. Reconnectez la boîte pour retrouver vos messages et pièces jointes — vos données restent intactes."
            : "Connectez une boîte mail pour synchroniser vos messages et envoyer des emails depuis Gedify."}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/emails/connecter?provider=google"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--blue-600)" }}
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Connecter Google
          </Link>
          <Link
            href="/emails/connecter?provider=imap"
            className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <Server className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Connecter une boîte IMAP
          </Link>
        </div>
      </div>
    </div>
  );
}
