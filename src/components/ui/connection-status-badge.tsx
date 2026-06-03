import { CheckCircle2, AlertTriangle } from "lucide-react";
import { getPaperlessStatus } from "@/lib/paperless";

type ConnectionStatusBadgeProps = {
  className?: string;
  compact?: boolean;
  dark?: boolean;
};

export async function ConnectionStatusBadge({
  className = "",
  compact,
  dark,
}: ConnectionStatusBadgeProps) {
  const status = await getPaperlessStatus();
  const connected = status.connected;
  const label = connected ? "Gedify connecté" : "Gedify indisponible";
  const versionLine = connected
    ? status.version
      ? `Gedify ${status.version}`
      : "API joignable"
    : status.error?.slice(0, 80) ?? "Vérifier les variables serveur";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur ${
          connected
            ? "border-emerald-200 bg-emerald-50/80 text-emerald-700"
            : "border-amber-200 bg-amber-50/80 text-amber-800"
        } ${className}`}
        title={versionLine}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            connected ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" : "bg-amber-500"
          }`}
          aria-hidden="true"
        />
        {label}
      </span>
    );
  }

  if (dark) {
    return (
      <div className={`${className}`} role="status">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.2)]" : "bg-amber-400"}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{label}</p>
            <p className="text-[10px] truncate" style={{ color: "#4A6A8A" }}>{versionLine}</p>
          </div>
        </div>
        <a
          href="/statut"
          className="mt-2 block text-[10px] font-medium transition-colors"
          style={{ color: "#4A6A8A" }}
        >
          Voir les paramètres →
        </a>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        connected
          ? "border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-emerald-50/40"
          : "border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-amber-50/40"
      } ${className}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            connected ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
          }`}
        >
          {connected ? (
            <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold leading-tight ${
              connected ? "text-emerald-900" : "text-amber-900"
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-0.5 truncate text-xs leading-tight ${
              connected ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {versionLine}
          </p>
        </div>
      </div>
    </div>
  );
}
