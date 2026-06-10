import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { GoogleConnectButton } from "@/components/mail-connector/google-connect-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { isSecureStorageReady } from "@/lib/mail-connector/encryption";
import { findProvider } from "@/lib/mail-connector/providers";

export const dynamic = "force-dynamic";

export default async function EmailComptesPage() {
  const [accounts] = await Promise.all([listAccounts()]);
  const secureReady = isSecureStorageReady();

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/emails", label: "Emails" }}
        eyebrow="Connecteurs mail"
        title="Comptes email"
        description="Liste des boîtes mail surveillées par Gedify."
        actions={
          <>
            <GoogleConnectButton returnTo="/emails/comptes" />
            <Link
              href="/emails/connecter"
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Connecter une boîte
            </Link>
          </>
        }
      />

      {!secureReady ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 backdrop-blur">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
            <ShieldAlert className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-bold text-amber-900">Stockage sécurisé à connecter</p>
            <p className="mt-1 leading-6 text-amber-800/90">
              Définissez{" "}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">MAIL_CONNECTOR_KEY</code>{" "}
              côté serveur pour activer le chiffrement des mots de passe IMAP.
            </p>
          </div>
        </div>
      ) : null}

      {accounts.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Inbox}
            title="Connectez votre première boîte mail"
            description="Vous pourrez importer automatiquement les factures, courriers et pièces jointes administratives dans la GED."
            action={
              <Link
                href="/emails/connecter"
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600"
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Démarrer l&apos;assistant
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => {
            const provider = findProvider(account.provider);
            return (
              <Link
                key={account.id}
                href={`/emails/comptes/${account.id}`}
                className="group flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_8px_28px_-12px_rgba(15,23,42,0.10)] backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_36px_-12px_rgba(37,99,235,0.18)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-extrabold text-slate-900">
                      {account.name}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">{account.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {account.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Désactivé
                      </span>
                    )}
                    {account.lastError ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                        <AlertTriangle className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                        Erreur
                      </span>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <Field label="Fournisseur" value={provider?.name ?? account.provider} />
                  <Field label="Dossier" value={account.watchedFolder} />
                  <Field
                    label="Hôte"
                    value={`${account.imapHost}:${account.imapPort}`}
                  />
                  <Field
                    label="Mot de passe"
                    value={account.hasPassword ? "Chiffré" : "Non enregistré"}
                  />
                  <Field
                    label="Dernière synchro"
                    value={account.lastSyncAt ? new Date(account.lastSyncAt).toLocaleString("fr-FR") : "Aucune"}
                  />
                  <Field
                    label="Synchro"
                    value={`${account.syncIntervalMinutes} min`}
                  />
                </dl>

                {account.lastError ? (
                  <p className="mt-4 line-clamp-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {account.lastError}
                  </p>
                ) : null}

                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                  Détails et actions
                  <ArrowRight
                    className="h-3 w-3 transition group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-slate-800">{value}</dd>
    </div>
  );
}
