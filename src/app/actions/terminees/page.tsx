import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { ActionList } from "@/components/actions/action-list";
import { listActions } from "@/lib/actions/action-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Terminées — Actions" };

export default async function ActionsTermineesPage() {
  const actions = (await listActions()).filter((a) => a.status === "done" || a.status === "cancelled");
  return (
    <SpaceLayout spaceId="actions">
      <ActionList actions={actions} emptyTitle="Aucune action terminée" emptyDescription="Les actions clôturées apparaîtront ici." />
    </SpaceLayout>
  );
}
