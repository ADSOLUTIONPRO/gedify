import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { ActionList } from "@/components/actions/action-list";
import { listActions } from "@/lib/actions/action-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Automatiques — Actions" };

export default async function ActionsAutomatiquesPage() {
  const actions = (await listActions()).filter((a) => a.createdFrom === "ai");
  return (
    <SpaceLayout spaceId="actions">
      <p className="mb-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
        Actions créées par l&apos;IA depuis l&apos;analyse de vos documents, emails et items financiers. Elles attendent
        validation : <strong style={{ color: "var(--text-main)" }}>jamais exécutées automatiquement</strong>.
      </p>
      <ActionList actions={actions} emptyTitle="Aucune action IA" emptyDescription="Les actions proposées par l'analyse IA apparaîtront ici." />
    </SpaceLayout>
  );
}
