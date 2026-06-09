import Link from "next/link";

type Props = {
  returnTo?: string;
  accountId?: string;
  label?: string;
  disabledMessage?: string;
};

/**
 * Server component : démarre le flux OAuth Microsoft via
 * /api/connectors/outlook/start. Lien pur — aucun secret côté client.
 */
export function OutlookConnectButton({
  returnTo = "/messagerie/parametres-emails",
  accountId,
  label = "Connecter Microsoft",
  disabledMessage,
}: Props) {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  if (accountId) params.set("accountId", accountId);
  const href = `/api/connectors/outlook/start?${params.toString()}`;

  if (disabledMessage) {
    return (
      <span
        title={disabledMessage}
        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400"
      >
        <OutlookLogo />
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
    >
      <OutlookLogo />
      {label}
    </Link>
  );
}

function OutlookLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="8.4" height="8.4" fill="#F25022" />
      <rect x="9.6" y="0" width="8.4" height="8.4" fill="#7FBA00" />
      <rect x="0" y="9.6" width="8.4" height="8.4" fill="#00A4EF" />
      <rect x="9.6" y="9.6" width="8.4" height="8.4" fill="#FFB900" />
    </svg>
  );
}
