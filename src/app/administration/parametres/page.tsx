import type { Metadata } from "next";
import { AdministrationSettings } from "@/components/settings/administration-settings";
import { getPaperlessStatus } from "@/lib/paperless";
import { getGedifyFeatureFlags } from "@/lib/settings/feature-flags";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paramètres — Administration" };

/**
 * Page Paramètres simplifiée : ne conserve que les réglages réellement
 * paramétrables (GED & documents) + « À propos ». Les autres blocs étaient des
 * résumés redondants avec les vrais espaces → supprimés. On ne charge donc plus
 * que l'état moteur (À propos) et les feature flags (toggle IA à l'import).
 */
export default async function AdministrationParametresPage() {
  const [status, flags] = await Promise.all([
    getPaperlessStatus().catch(() => null),
    getGedifyFeatureFlags().catch(() => ({ financeSpaceEnabled: true, autoBudgetClassificationEnabled: true, autoAiAnalysisEnabled: true, autoContactSyncEnabled: true })),
  ]);

  return (
    <AdministrationSettings
      engine={{ connected: Boolean(status?.connected), version: status?.version ?? null, apiVersion: status?.apiVersion ?? null, error: status?.error ?? null }}
      initialFlags={{
        financeSpaceEnabled: flags.financeSpaceEnabled,
        autoBudgetClassificationEnabled: flags.autoBudgetClassificationEnabled,
        autoAiAnalysisEnabled: flags.autoAiAnalysisEnabled,
        autoContactSyncEnabled: flags.autoContactSyncEnabled,
      }}
    />
  );
}
