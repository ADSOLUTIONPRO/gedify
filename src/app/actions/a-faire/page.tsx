import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { ActionList } from "@/components/actions/action-list";
import { AddActionButton } from "@/components/actions/action-form";
import { listActions } from "@/lib/actions/action-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "À faire — Actions" };

export default async function ActionsAFairePage() {
  const actions = (await listActions()).filter((a) => a.status === "todo");
  return (
    <SpaceLayout spaceId="actions" actions={<AddActionButton />}>
      <ActionList actions={actions} emptyTitle="Rien à faire" emptyDescription="Aucune action en attente d'exécution." />
    </SpaceLayout>
  );
}
