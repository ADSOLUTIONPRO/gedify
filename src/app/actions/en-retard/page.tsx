import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { ActionList } from "@/components/actions/action-list";
import { AddActionButton } from "@/components/actions/action-form";
import { listActions } from "@/lib/actions/action-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "En retard — Actions" };

export default async function ActionsEnRetardPage() {
  const actions = (await listActions()).filter((a) => a.status === "overdue");
  return (
    <SpaceLayout spaceId="actions" actions={<AddActionButton />}>
      <p className="mb-3 text-[13px]" style={{ color: "var(--danger)" }}>
        Actions dont l&apos;échéance est dépassée. Traitez en priorité, ou demandez un délai via un courrier.
      </p>
      <ActionList actions={actions} emptyTitle="Aucun retard 🎉" emptyDescription="Toutes les échéances sont à jour." />
    </SpaceLayout>
  );
}
