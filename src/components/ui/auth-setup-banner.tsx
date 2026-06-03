import { ShieldAlert } from "lucide-react";

/**
 * Bandeau affiché quand AUTH_SECRET manque (version autonome : plus de
 * Gedify à configurer, le moteur documentaire est embarqué). Composant
 * serveur — lit les env vars.
 */
export function AuthSetupBanner() {
  const authConfigured = Boolean(process.env.AUTH_SECRET?.trim());

  if (authConfigured) return null;

  const missing: string[] = [];
  if (!process.env.AUTH_SECRET?.trim()) missing.push("AUTH_SECRET");

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 text-[13px]"
      style={{ background: "#FEF3C7", borderBottom: "1px solid #FDE68A", color: "#92400E" }}
      role="alert"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0">
        <strong>Connexion impossible — identifiants non configurés.</strong>
        <span className="ml-2">
          Variables manquantes dans{" "}
          <code className="rounded bg-amber-100 px-1 font-mono text-[12px]">.env.local</code> :{" "}
          <code className="font-mono text-[12px]">{missing.join(", ")}</code>.
        </span>
        <span className="ml-2">
          Suivez le guide de configuration pour activer l&apos;accès.
        </span>
      </div>
    </div>
  );
}
