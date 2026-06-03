import Link from "next/link";
import { Mail, ShieldCheck, Sparkles } from "lucide-react";

type NoGmailStateProps = {
  oauthConfigured: boolean;
  /** Le compte existe mais son token est expiré/révoqué → reconnexion. */
  needsReconnect?: boolean;
};

export function NoGmailState({ oauthConfigured, needsReconnect }: NoGmailStateProps) {
  return (
    <div
      className="rounded-2xl bg-white p-6"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 2px 16px -8px rgba(8,18,37,0.08)",
      }}
    >
      <div className="mx-auto max-w-xl text-center">
        <span
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(11,92,255,0.10)", color: "var(--blue-600)" }}
        >
          <Mail className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="text-base font-extrabold" style={{ color: "var(--text-main)" }}>
          {needsReconnect ? "Reconnectez votre compte Google" : "Connectez Gmail pour activer la messagerie"}
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {needsReconnect
            ? "Votre session Google a expiré ou a été révoquée. Reconnectez le compte pour retrouver vos messages et pièces jointes — vos données GED restent intactes."
            : "Gedify lit votre boîte de réception en lecture seule. Les tokens restent chiffrés côté serveur — aucun accès en écriture ne sera demandé tant que vous n'activez pas la phase d'envoi."}
        </p>

        {oauthConfigured ? (
          <Link
            href="/emails/connecter"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--blue-600)" }}
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {needsReconnect ? "Reconnecter Gmail" : "Connecter Gmail"}
          </Link>
        ) : (
          <div
            className="mt-4 rounded-xl p-3 text-left text-xs"
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.25)",
              color: "#78350F",
            }}
          >
            <p className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
              OAuth Google non configuré
            </p>
            <p className="mt-1 leading-snug">
              Définissez sur le serveur : <code className="font-mono">GOOGLE_CLIENT_ID</code>,{" "}
              <code className="font-mono">GOOGLE_CLIENT_SECRET</code>,{" "}
              <code className="font-mono">GOOGLE_REDIRECT_URI</code> et{" "}
              <code className="font-mono">CONNECTOR_SECRET_KEY</code>. Une fois en place,
              relancez l&apos;application.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
