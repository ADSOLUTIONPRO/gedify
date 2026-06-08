import type { Metadata } from "next";
import { AdministrationSettings } from "@/components/settings/administration-settings";
import { getPaperlessStatus } from "@/lib/paperless";
import { getGedifyFeatureFlags } from "@/lib/settings/feature-flags";
import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";
import { listSignatures } from "@/lib/messaging/email-signature-store";
import { getHiddenSenderEmails } from "@/lib/messaging/hidden-senders-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paramètres — Administration" };

/** Page UNIQUE des paramètres. Réunit tous les réglages (réutilise les panneaux/
    données déjà câblés) ; les écrans métier restent accessibles via « Gérer ». */
export default async function AdministrationParametresPage() {
  const [status, flags, gmailAccounts, signatures, hidden] = await Promise.all([
    getPaperlessStatus().catch(() => null),
    getGedifyFeatureFlags().catch(() => ({ financeSpaceEnabled: true, autoBudgetClassificationEnabled: true })),
    listGmailAccounts().catch(() => []),
    listSignatures().catch(() => []),
    getHiddenSenderEmails().catch(() => new Set<string>()),
  ]);

  const storageTotal = status?.system?.storage?.total ?? 0;
  const storageAvailable = status?.system?.storage?.available ?? 0;
  const storageUsedPercent = storageTotal > 0 ? Math.round(((storageTotal - storageAvailable) / storageTotal) * 100) : null;

  return (
    <AdministrationSettings
      account={{ email: status?.user?.email ?? null, mfa: Boolean(status?.user?.is_mfa_enabled) }}
      engine={{ connected: Boolean(status?.connected), version: status?.version ?? null, apiVersion: status?.apiVersion ?? null, error: status?.error ?? null }}
      storageUsedPercent={storageUsedPercent}
      initialFlags={{ financeSpaceEnabled: flags.financeSpaceEnabled, autoBudgetClassificationEnabled: flags.autoBudgetClassificationEnabled }}
      counts={{ gmailAccounts: gmailAccounts.length, signatures: signatures.length, customFields: null, workflows: null, hiddenSenders: hidden.size }}
      lastBackupAt={null}
    />
  );
}
