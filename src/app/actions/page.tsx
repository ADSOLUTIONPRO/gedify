import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { AddActionButton } from "@/components/actions/action-form";
import { ActionsOverview } from "@/components/actions/actions-overview";
import type { ActionAdvice } from "@/components/actions/action-advice-panel";
import { listActions } from "@/lib/actions/action-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Actions — Gedify" };

export default async function ActionsPage() {
  const actions = await listActions();

  const tips: ActionAdvice[] = [];
  const overdue = actions.filter((a) => a.status === "overdue");
  const urgent = actions.filter((a) => a.priority === "urgent" && a.status !== "done" && a.status !== "cancelled");
  const aiToValidate = actions.filter((a) => a.createdFrom === "ai" && a.status === "todo");

  if (overdue.length > 0) tips.push({ id: "overdue", severity: "danger", title: `${overdue.length} action(s) en retard`, detail: "Traitez d'abord les paiements et réponses dépassés. Vous pouvez demander un délai ou contester via un courrier." });
  if (urgent.length > 0) tips.push({ id: "urgent", severity: "warning", title: `${urgent.length} action(s) urgente(s)`, detail: "Priorisez ces tâches dans la journée — créer un rappel évite d'oublier." });
  if (aiToValidate.length > 0) tips.push({ id: "ai", severity: "info", title: `${aiToValidate.length} propositions IA à valider`, detail: "Les actions suggérées par l'IA attendent votre validation — modifiez si besoin avant de les exécuter." });

  return (
    <SpaceLayout spaceId="actions" actions={<AddActionButton />}>
      <ActionsOverview actions={actions} tips={tips} />
    </SpaceLayout>
  );
}
