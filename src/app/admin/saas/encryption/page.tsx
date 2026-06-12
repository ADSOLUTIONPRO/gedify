import { AlertTriangle, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SuperAdminHero } from "@/components/admin-ui";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMasterKeyStatus, isEncryptionConfigured } from "@/lib/saas/encryption/master-key";
import { listTenantsWithKey } from "@/lib/saas/encryption/tenant-keys";
import { getEncryptionAudit } from "@/lib/saas/encryption/file-audit";
import { listTenants } from "@/lib/tenant/tenant-store";
import { ensureAllKeysAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Chiffrement" },
];

export default async function EncryptionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Chiffrement" /><SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Chiffrement" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const master = getMasterKeyStatus();
  const configured = isEncryptionConfigured();
  const [tenants, withKey, audit] = await Promise.all([
    listTenants().catch(() => []),
    listTenantsWithKey(),
    getEncryptionAudit().catch(() => ({ found: 0, encrypted: 0, plain: 0, noTenant: 0, lastRun: null })),
  ]);
  const keySet = new Set(withKey);
  const missing = tenants.filter((t) => !keySet.has(t.id));
  const migratedDone = audit.found > 0 && audit.plain === 0;

  return (
    <PageShell>
      <SuperAdminHero breadcrumb={breadcrumb} eyebrow="Administration SaaS" title="Chiffrement au repos" subtitle="Chiffrement des fichiers par tenant (enveloppe AES-256-GCM). La clé maître n'est jamais exposée." icon={<Lock className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />} />

      {sp.created ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{sp.created} clé(s) tenant générée(s).</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      {!configured ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <code className="font-mono">ENCRYPTION_MASTER_KEY</code> {master.present ? "présente mais invalide (attendu : 32 octets en base64 ou hex)." : "absente."} Le
            chiffrement est inactif : les nouveaux fichiers sont écrits en clair. Générez une clé via <code className="font-mono">openssl rand -base64 32</code>.
          </span>
        </div>
      ) : null}

      <SectionCard icon={Lock} title="État (sans secret)">
        <MetadataGrid columns={3} items={[
          { label: "Clé maître (KEK)", value: master.present ? (master.valid ? "✓ présente & valide" : "⚠️ présente mais invalide") : "✗ absente" },
          { label: "Chiffrement actif", value: configured ? "Oui" : "Non" },
          { label: "Algorithme", value: "AES-256-GCM (enveloppe)" },
          { label: "Tenants", value: String(tenants.length) },
          { label: "Avec clé de données", value: String(withKey.length) },
          { label: "Sans clé", value: String(missing.length) },
        ]} />
        {configured ? (
          <form action={ensureAllKeysAction} className="mt-4">
            <button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Générer les clés manquantes</button>
          </form>
        ) : null}
      </SectionCard>

      <SectionCard icon={Lock} title="Fichiers documents (migration)">
        <MetadataGrid columns={3} items={[
          { label: "Nouveaux fichiers chiffrés", value: configured ? "Oui" : "Non" },
          { label: "Fichiers existants migrés", value: audit.found === 0 ? "—" : (migratedDone ? "Oui" : "Partiel") },
          { label: "Encore en clair", value: String(audit.plain) },
          { label: "Fichiers trouvés", value: String(audit.found) },
          { label: "Fichiers chiffrés", value: String(audit.encrypted) },
          { label: "En clair sans tenant", value: String(audit.noTenant) },
          {
            label: "Dernière migration",
            value: audit.lastRun?.finishedAt
              ? `${new Date(audit.lastRun.finishedAt).toLocaleString("fr-FR")}${audit.lastRun.dryRun ? " (simulation)" : ""}`
              : "jamais",
          },
          { label: "Dernier run — chiffrés", value: audit.lastRun ? String(audit.lastRun.encrypted) : "—" },
          { label: "Dernier run — erreurs", value: audit.lastRun ? String(audit.lastRun.errors) : "—" },
        ]} />
        {audit.plain > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{audit.plain} fichier(s) encore en clair. Lancez <code className="font-mono">npm run saas:encrypt-existing-files</code> (idempotent) côté serveur pour les chiffrer.</span>
          </p>
        ) : audit.found > 0 ? (
          <p className="mt-3 text-[12px] text-emerald-700">✓ Tous les fichiers documents inventoriés sont chiffrés.</p>
        ) : null}
      </SectionCard>

      <SectionCard icon={KeyRound} title="Clés par tenant" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
              <th className="px-4 py-2">Tenant</th><th className="px-4 py-2">Identifiant</th><th className="px-4 py-2">Clé de données</th>
            </tr></thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                  <td className="px-4 py-2 font-semibold">{t.name ?? t.slug}</td>
                  <td className="px-4 py-2"><code className="font-mono text-[11px]">{t.id}</code></td>
                  <td className="px-4 py-2">
                    {keySet.has(t.id)
                      ? <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#DCFCE7", color: "#15803D" }}>✓ présente (chiffrée)</span>
                      : <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#FEF3C7", color: "#B45309" }}>absente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <p className="text-[12px] text-slate-500">
        La clé de données (DEK) de chaque tenant est stockée <strong>chiffrée</strong> par la clé maître (jamais en clair). Le déchiffrement
        des fichiers n&apos;a lieu que côté serveur, lors d&apos;une lecture autorisée (téléchargement, miniatures, OCR/IA).
      </p>
    </PageShell>
  );
}
