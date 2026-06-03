import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { ActionList } from "@/components/actions/action-list";
import { AddActionButton } from "@/components/actions/action-form";
import { listActions } from "@/lib/actions/action-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "En cours — Actions" };

export default async function ActionsEnCoursPage() {
  const actions = (await listActions()).filter((a) => a.status === "in-progress");
  return (
    <SpaceLayout spaceId="actions" actions={<AddActionButton />}>
      <ActionList actions={actions} emptyTitle="Aucune action en cours" emptyDescription="Les actions démarrées apparaîtront ici." />
    </SpaceLayout>
  );
}
