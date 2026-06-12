import Link from "next/link";
import { ShieldCheck, LogIn, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSecurityEvents } from "@/lib/saas/security/security-events";
import { getMfaState } from "@/lib/saas/mfa/mfa-store";
import { getAppEnv } from "@/lib/config/environment";
import { MfaSettings } from "@/components/auth/mfa-settings";

export const dynamic = "force-dynamic";

const breadcrumb = [{ href: "/dashboard", label: "Accueil" }, { label: "Sécurité du compte" }];
function when(v: unknown): string { return v ? new Date(String(v)).toLocaleString("fr-FR") : "—"; }

export default async function AccountSecurityPage() {
  const me = await getCurrentUser();
  if (!me) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Sécurité du compte" /><SectionCard icon={ShieldCheck} title="Non connecté"><p className="text-sm text-slate-600">Veuillez vous connecter.</p></SectionCard></PageShell>;
  }
  const mfa = await getMfaState(me.id).catch(() => ({ enabled: false, pending: false, backupRemaining: 0 }));
  const isProd = getAppEnv() === "production";
  const mandatory = Boolean(me.is_superuser);
  const canDisable = !(me.is_superuser && isProd); // superadmin en prod : MFA non désactivable
  // Un utilisateur ne voit QUE ses propres événements (jamais ceux d'un autre).
  const events = (await getSecurityEvents({ limit: 100 }).catch(() => [])).filter((e) => Number(e.user_id) === me.id);
  const logins = events.filter((e) => e.event_type === "login_success").slice(0, 15);
  const others = events.filter((e) => e.event_type !== "login_success").slice(0, 15);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Sécurité du compte" description="Double authentification et activité récente de votre compte." />

      <SectionCard icon={KeyRound} title="Double authentification (MFA)">
        <MfaSettings initialEnabled={mfa.enabled} backupRemaining={mfa.backupRemaining} mandatory={mandatory} canDisable={canDisable} />
      </SectionCard>

      <SectionCard icon={LogIn} title="Dernières connexions" bodyClassName="p-0">
        {logins.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Aucune connexion enregistrée récemment.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
            {logins.map((e) => (
              <li key={String(e.id)} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                <span className="text-slate-700">{when(e.created_at)}</span>
                <span className="font-mono text-[11px] text-slate-500">{e.ip_address ? String(e.ip_address) : "IP inconnue"}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Événements de sécurité">
        {others.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun autre événement (changement de mot de passe, etc.).</p>
        ) : (
          <ul className="space-y-1.5">
            {others.map((e) => (
              <li key={String(e.id)} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[13px]" style={{ borderColor: "var(--border-soft)" }}>
                <span>{String(e.message)}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{when(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-slate-500">
          Pour changer votre mot de passe, rendez-vous sur votre <Link href="/profil" style={{ color: "var(--blue-600)" }}>profil</Link>. La double authentification (2FA) et la gestion des sessions actives arriveront prochainement.
        </p>
      </SectionCard>
    </PageShell>
  );
}
