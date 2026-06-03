import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { ActionList } from "@/components/actions/action-list";
import { AddActionButton } from "@/components/actions/action-form";
import { listActions } from "@/lib/actions/action-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "En attente — Actions" };

export default async function ActionsEnAttentePage() {
  const actions = (await listActions()).filter((a) => a.status === "waiting");
  return (
    <SpaceLayout spaceId="actions" actions={<AddActionButton />}>
      <ActionList actions={actions} emptyTitle="Aucune action en attente" emptyDescription="Les actions bloquées sur une réponse externe apparaîtront ici." />
    </SpaceLayout>
  );
}
